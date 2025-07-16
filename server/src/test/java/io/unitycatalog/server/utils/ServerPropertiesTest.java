package io.unitycatalog.server.utils;

import static org.junit.jupiter.api.Assertions.*;

import io.unitycatalog.server.service.credential.aws.S3StorageConfig;
import java.util.Map;
import java.util.Properties;
import org.junit.jupiter.api.Test;

public class ServerPropertiesTest {

  @Test
  public void testS3ConfigurationWithServiceEndpoint() {
    Properties props = new Properties();
    props.setProperty("s3.bucketPath.0", "s3://test-bucket");
    props.setProperty("s3.region.0", "us-east-1");
    props.setProperty("s3.awsRoleArn.0", "arn:aws:iam::123456789012:role/test-role");
    props.setProperty("s3.accessKey.0", "test-access-key");
    props.setProperty("s3.secretKey.0", "test-secret-key");
    props.setProperty("s3.sessionToken.0", "test-session-token");
    props.setProperty("s3.serviceEndpoint.0", "http://localhost:9000");

    ServerProperties serverProperties = new ServerProperties(props);
    Map<String, S3StorageConfig> s3Configs = serverProperties.getS3Configurations();

    assertEquals(1, s3Configs.size());
    assertTrue(s3Configs.containsKey("s3://test-bucket"));

    S3StorageConfig config = s3Configs.get("s3://test-bucket");
    assertEquals("s3://test-bucket", config.getBucketPath());
    assertEquals("us-east-1", config.getRegion());
    assertEquals("arn:aws:iam::123456789012:role/test-role", config.getAwsRoleArn());
    assertEquals("test-access-key", config.getAccessKey());
    assertEquals("test-secret-key", config.getSecretKey());
    assertEquals("test-session-token", config.getSessionToken());
    assertEquals("http://localhost:9000", config.getServiceEndpoint());
  }

  @Test
  public void testS3ConfigurationWithoutServiceEndpoint() {
    Properties props = new Properties();
    props.setProperty("s3.bucketPath.0", "s3://test-bucket");
    props.setProperty("s3.region.0", "us-west-2");
    props.setProperty("s3.awsRoleArn.0", "arn:aws:iam::123456789012:role/test-role");

    ServerProperties serverProperties = new ServerProperties(props);
    Map<String, S3StorageConfig> s3Configs = serverProperties.getS3Configurations();

    assertEquals(1, s3Configs.size());
    S3StorageConfig config = s3Configs.get("s3://test-bucket");
    assertNull(config.getServiceEndpoint());
  }

  @Test
  public void testMultipleS3ConfigurationsWithMixedEndpoints() {
    Properties props = new Properties();
    // First config with service endpoint
    props.setProperty("s3.bucketPath.0", "s3://bucket-1");
    props.setProperty("s3.region.0", "us-east-1");
    props.setProperty("s3.awsRoleArn.0", "arn:aws:iam::123456789012:role/role-1");
    props.setProperty("s3.serviceEndpoint.0", "http://minio:9000");

    // Second config without service endpoint
    props.setProperty("s3.bucketPath.1", "s3://bucket-2");
    props.setProperty("s3.region.1", "eu-west-1");
    props.setProperty("s3.awsRoleArn.1", "arn:aws:iam::123456789012:role/role-2");

    ServerProperties serverProperties = new ServerProperties(props);
    Map<String, S3StorageConfig> s3Configs = serverProperties.getS3Configurations();

    assertEquals(2, s3Configs.size());

    S3StorageConfig config1 = s3Configs.get("s3://bucket-1");
    assertEquals("http://minio:9000", config1.getServiceEndpoint());

    S3StorageConfig config2 = s3Configs.get("s3://bucket-2");
    assertNull(config2.getServiceEndpoint());
  }
}
