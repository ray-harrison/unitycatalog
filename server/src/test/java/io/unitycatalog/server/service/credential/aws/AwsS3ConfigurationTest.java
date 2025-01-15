package io.unitycatalog.server.service.credential.aws;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;

public class AwsS3ConfigurationTest {
  @Test
  public void getS3Configurations() {
    // Given
    Map<String, S3StorageConfig> s3BucketConfigMap = new HashMap<>();
    S3StorageConfig s3StorageConfig =
        S3StorageConfig.builder()
            .bucketPath("bucketPath")
            .region("region")
            .awsRoleArn("awsRoleArn")
            .accessKey("accessKey")
            .secretKey("secretKey")
            .sessionToken("sessionToken")
            .serviceEndpoint("https://serviceEndpoint")
            .build();
    s3BucketConfigMap.put("s3://storageBase", s3StorageConfig);

    // When
    S3StorageConfig s3StorageConfigResult = s3BucketConfigMap.get("s3://storageBase");

    // Then
    assertEquals(s3StorageConfig, s3StorageConfigResult);
  }
}
