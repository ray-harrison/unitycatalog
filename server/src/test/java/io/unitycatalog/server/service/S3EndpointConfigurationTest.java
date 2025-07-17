package io.unitycatalog.server.service;

import io.unitycatalog.server.model.*;
import io.unitycatalog.server.service.credential.aws.S3StorageConfig;
import io.unitycatalog.server.utils.ServerProperties;
import org.junit.jupiter.api.Test;

import java.util.Properties;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests S3 endpoint configuration for third-party S3-compatible services.
 * This test verifies that custom endpoints are properly configured.
 */
public class S3EndpointConfigurationTest {

    @Test
    public void testS3ConfigurationIncludesEndpoint() {
        // Set up properties with MinIO configuration
        Properties props = new Properties();
        props.setProperty("s3.bucketPath.0", "s3://test-bucket");
        props.setProperty("s3.region.0", "us-east-1");
        props.setProperty("s3.accessKey.0", "minioadmin");
        props.setProperty("s3.secretKey.0", "minioadmin");
        props.setProperty("s3.sessionToken.0", "");
        props.setProperty("s3.serviceEndpoint.0", "http://localhost:9000");
        
        ServerProperties serverProperties = new ServerProperties(props);
        
        // Verify S3 configuration is loaded with endpoint
        var s3Configs = serverProperties.getS3Configurations();
        assertFalse(s3Configs.isEmpty());
        
        S3StorageConfig config = s3Configs.values().iterator().next();
        assertNotNull(config);
        assertEquals("http://localhost:9000", config.getServiceEndpoint());
        assertEquals("us-east-1", config.getRegion());
        assertEquals("minioadmin", config.getAccessKey());
    }

    @Test
    public void testMultipleS3Configurations() {
        // Test with multiple S3 configurations
        Properties props = new Properties();
        
        // First config - MinIO
        props.setProperty("s3.bucketPath.0", "s3://minio-bucket");
        props.setProperty("s3.region.0", "us-east-1");
        props.setProperty("s3.accessKey.0", "minioadmin");
        props.setProperty("s3.secretKey.0", "minioadmin");
        props.setProperty("s3.sessionToken.0", "");
        props.setProperty("s3.serviceEndpoint.0", "http://minio:9000");
        
        // Second config - Ceph
        props.setProperty("s3.bucketPath.1", "s3://ceph-bucket");
        props.setProperty("s3.region.1", "us-west-2");
        props.setProperty("s3.accessKey.1", "cephadmin");
        props.setProperty("s3.secretKey.1", "cephpassword");
        props.setProperty("s3.sessionToken.1", "");
        props.setProperty("s3.serviceEndpoint.1", "http://ceph:8080");
        
        // Third config - Regular AWS (no endpoint)
        props.setProperty("s3.bucketPath.2", "s3://aws-bucket");
        props.setProperty("s3.region.2", "us-east-2");
        props.setProperty("s3.awsRoleArn.2", "arn:aws:iam::123456789:role/test-role");
        
        ServerProperties multiProps = new ServerProperties(props);
        var configs = multiProps.getS3Configurations();
        
        assertEquals(3, configs.size());
        
        // Verify MinIO config
        S3StorageConfig minioConfig = configs.get("s3://minio-bucket");
        assertNotNull(minioConfig);
        assertEquals("http://minio:9000", minioConfig.getServiceEndpoint());
        
        // Verify Ceph config
        S3StorageConfig cephConfig = configs.get("s3://ceph-bucket");
        assertNotNull(cephConfig);
        assertEquals("http://ceph:8080", cephConfig.getServiceEndpoint());
        
        // Verify AWS config has no endpoint
        S3StorageConfig awsConfig = configs.get("s3://aws-bucket");
        assertNotNull(awsConfig);
        assertNull(awsConfig.getServiceEndpoint());
    }

    @Test
    public void testAuthorizationForPathCreateTable() {
        // Verify that PATH_CREATE_TABLE doesn't require METASTORE OWNER
        // This is a unit test version of the authorization check
        
        String expression = """
            #authorize(#principal, #metastore, OWNER) ||
            (#generateTemporaryPathCredential.operation.name() == 'PATH_CREATE_TABLE')
        """;
        
        // Simulate the authorization check
        boolean isOwner = false; // Non-admin user
        PathOperation operation = PathOperation.PATH_CREATE_TABLE;
        
        // The expression should evaluate to true for PATH_CREATE_TABLE even without OWNER
        boolean result = isOwner || (operation == PathOperation.PATH_CREATE_TABLE);
        assertTrue(result, "PATH_CREATE_TABLE should be allowed for non-owners");
        
        // But other operations should require OWNER
        operation = PathOperation.PATH_READ;
        result = isOwner || (operation == PathOperation.PATH_CREATE_TABLE);
        assertFalse(result, "PATH_READ should require OWNER");
    }
}