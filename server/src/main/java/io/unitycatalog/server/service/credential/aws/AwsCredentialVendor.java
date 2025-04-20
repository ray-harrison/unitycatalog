package io.unitycatalog.server.service.credential.aws;

import io.unitycatalog.server.exception.BaseException;
import io.unitycatalog.server.exception.ErrorCode;
import io.unitycatalog.server.service.credential.CredentialContext;
import io.unitycatalog.server.utils.ServerProperties;
import java.net.URI;
import java.time.Duration;
import java.util.Map;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.AwsCredentialsProvider;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.sts.StsClient;
import software.amazon.awssdk.services.sts.StsClientBuilder;
import software.amazon.awssdk.services.sts.model.Credentials;

public class AwsCredentialVendor {

  private final Map<String, S3StorageConfig> s3Configurations;
  @Getter @Setter private String vendorServiceEndpoint;

  public AwsCredentialVendor(ServerProperties serverProperties) {
    this.s3Configurations = serverProperties.getS3Configurations();
  }

  public Credentials vendAwsCredentials(CredentialContext context) {
    S3StorageConfig s3StorageConfig = s3Configurations.get(context.getStorageBase());
    if (s3StorageConfig == null) {
      throw new BaseException(ErrorCode.FAILED_PRECONDITION, "S3 bucket configuration not found.");
    }

    Credentials credentials;

    if (s3StorageConfig.getSessionToken() != null && !s3StorageConfig.getSessionToken().isEmpty()) {
      credentials =
          Credentials.builder()
              .accessKeyId(s3StorageConfig.getAccessKey())
              .secretAccessKey(s3StorageConfig.getSecretKey())
              .sessionToken(s3StorageConfig.getSessionToken())
              .build();
    } else {
      StsClient stsClient = getStsClientForStorageConfig(s3StorageConfig);
      String roleSessionName = "uc-%s".formatted(UUID.randomUUID());
      String awsPolicy =
          AwsPolicyGenerator.generatePolicy(context.getPrivileges(), context.getLocations());

      credentials =
          stsClient
              .assumeRole(
                  r ->
                      r.roleArn(s3StorageConfig.getAwsRoleArn())
                          .policy(awsPolicy)
                          .roleSessionName(roleSessionName)
                          .durationSeconds((int) Duration.ofHours(1).toSeconds()))
              .credentials();
    }

    return credentials;
  }

  private StsClient getStsClientForStorageConfig(S3StorageConfig s3StorageConfig) {

    AwsCredentialsProvider credentialsProvider;
    if (s3StorageConfig.getAccessKey() != null
        && !s3StorageConfig.getAccessKey().isEmpty()
        && s3StorageConfig.getSecretKey() != null
        && !s3StorageConfig.getSecretKey().isEmpty()) {
      credentialsProvider =
          StaticCredentialsProvider.create(
              AwsBasicCredentials.create(
                  s3StorageConfig.getAccessKey(), s3StorageConfig.getSecretKey()));
    } else {
      credentialsProvider = DefaultCredentialsProvider.create();
    }
    // TODO: should we try and set the region to something configurable or specific to the server
    // instead?
    StsClientBuilder builder =
        StsClient.builder()
            .credentialsProvider(credentialsProvider)
            .region(Region.of(s3StorageConfig.getRegion()));

    if (s3StorageConfig.getServiceEndpoint() != null
        && !s3StorageConfig.getServiceEndpoint().isBlank()) {
      builder.endpointOverride(URI.create(s3StorageConfig.getServiceEndpoint()));
      setVendorServiceEndpoint(s3StorageConfig.getServiceEndpoint());
    }

    return builder.build();
  }
}
