package io.unitycatalog.spark;

import io.unitycatalog.client.model.AwsCredentials;
import io.unitycatalog.client.model.GcpOauthToken;
import io.unitycatalog.client.model.TemporaryCredentials;
import org.junit.jupiter.api.Test;
import scala.collection.immutable.Map;

import static org.junit.jupiter.api.Assertions.*;

public class UCSingleCatalogEndpointTest {

    @Test
    public void testGenerateCredentialPropsIncludesEndpointForS3WhenProvided() {
        // Create AWS credentials with endpoint
        AwsCredentials awsCredentials = new AwsCredentials()
                .accessKeyId("test-access-key")
                .secretAccessKey("test-secret-key")
                .sessionToken("test-session-token")
                .endpoint("https://minio.example.com:9000");

        TemporaryCredentials temporaryCredentials = new TemporaryCredentials()
                .awsTempCredentials(awsCredentials);

        Map<String, String> props = UCSingleCatalog.generateCredentialProps("s3", temporaryCredentials);

        // Verify all expected properties are present
        assertEquals("test-access-key", props.apply("fs.s3a.access.key"));
        assertEquals("test-secret-key", props.apply("fs.s3a.secret.key"));
        assertEquals("test-session-token", props.apply("fs.s3a.session.token"));
        assertEquals("true", props.apply("fs.s3a.path.style.access"));
        assertEquals("https://minio.example.com:9000", props.apply("fs.s3a.endpoint"));
    }

    @Test
    public void testGenerateCredentialPropsExcludesEndpointForS3WhenNotProvided() {
        // Create AWS credentials without endpoint
        AwsCredentials awsCredentials = new AwsCredentials()
                .accessKeyId("test-access-key")
                .secretAccessKey("test-secret-key")
                .sessionToken("test-session-token");

        TemporaryCredentials temporaryCredentials = new TemporaryCredentials()
                .awsTempCredentials(awsCredentials);

        Map<String, String> props = UCSingleCatalog.generateCredentialProps("s3", temporaryCredentials);

        // Verify endpoint is not present
        assertFalse(props.contains("fs.s3a.endpoint"));
        // But other properties should still be there
        assertEquals("test-access-key", props.apply("fs.s3a.access.key"));
        assertEquals("test-secret-key", props.apply("fs.s3a.secret.key"));
        assertEquals("test-session-token", props.apply("fs.s3a.session.token"));
    }

    @Test
    public void testGenerateCredentialPropsExcludesEndpointForS3WhenEmpty() {
        // Create AWS credentials with empty endpoint
        AwsCredentials awsCredentials = new AwsCredentials()
                .accessKeyId("test-access-key")
                .secretAccessKey("test-secret-key")
                .sessionToken("test-session-token")
                .endpoint("");

        TemporaryCredentials temporaryCredentials = new TemporaryCredentials()
                .awsTempCredentials(awsCredentials);

        Map<String, String> props = UCSingleCatalog.generateCredentialProps("s3", temporaryCredentials);

        // Verify endpoint is not present when empty
        assertFalse(props.contains("fs.s3a.endpoint"));
    }

    @Test
    public void testGenerateCredentialPropsWorksForOtherSchemes() {
        // Test that other schemes (gs, abfs) still work as expected
        GcpOauthToken gcpCredentials = new GcpOauthToken()
                .oauthToken("test-gcp-token");

        TemporaryCredentials temporaryCredentials = new TemporaryCredentials()
                .gcpOauthToken(gcpCredentials)
                .expirationTime(System.currentTimeMillis() + 3600000);

        Map<String, String> props = UCSingleCatalog.generateCredentialProps("gs", temporaryCredentials);

        // Verify GCS properties are present
        assertTrue(props.contains(GcsVendedTokenProvider.ACCESS_TOKEN_KEY));
        assertEquals("ACCESS_TOKEN_PROVIDER", props.apply("fs.gs.auth.type"));
    }
}