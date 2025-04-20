package io.unitycatalog.server.utils;

import io.unitycatalog.server.model.AwsCredentials;
import io.unitycatalog.server.model.TemporaryCredentials;
import java.net.URI;
import java.util.Optional;
import software.amazon.awssdk.auth.credentials.AwsSessionCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3ClientBuilder;

public class S3ClientUtils {
  public S3ClientUtils() {}

  public static S3Client getS3Client(
      TemporaryCredentials temporaryCredentials, Optional<Region> region) {
    AwsCredentials awsCredentials = temporaryCredentials.getAwsTempCredentials();

    Region tempRegion = region.orElse(Region.US_EAST_1);

    S3ClientBuilder s3ClientBuilder =
        S3Client.builder()
            .credentialsProvider(
                StaticCredentialsProvider.create(
                    AwsSessionCredentials.create(
                        awsCredentials.getAccessKeyId(),
                        awsCredentials.getSecretAccessKey(),
                        awsCredentials.getSessionToken())))
            .region(tempRegion); // extracted from configuration

    if (awsCredentials.getServiceEndpoint() != null
        && !awsCredentials.getServiceEndpoint().isBlank()) {
      s3ClientBuilder.endpointOverride(URI.create(awsCredentials.getServiceEndpoint()));
    }

    return s3ClientBuilder.build();
  }
}
