# MinIO and S3-Compatible Storage Testing

This guide explains how to run automated tests for Unity Catalog's S3-compatible storage support.

## Overview

Unity Catalog supports S3-compatible storage services like MinIO, Ceph, and Wasabi through custom endpoint configuration. The test suite verifies:

1. Custom S3 endpoints are properly configured
2. Non-admin users can create external tables
3. Credentials are correctly vended with custom endpoints
4. Spark integration works with third-party S3 services

## Running Tests Locally

### Quick Test

Run all MinIO-related tests:

```bash
./bin/test-minio-integration
```

This script:
- Starts a MinIO container (if Docker is available)
- Runs all S3 endpoint configuration tests
- Verifies non-admin user workflows
- Tests Spark connector integration
- Provides a summary of results

### Individual Test Classes

Run specific test classes:

```bash
# S3 endpoint configuration tests
./build/sbt "server/testOnly io.unitycatalog.server.service.S3EndpointConfigurationTest"

# Server properties with S3 endpoints
./build/sbt "server/testOnly io.unitycatalog.server.utils.ServerPropertiesTest"

# Path credentials authorization
./build/sbt "server/testOnly io.unitycatalog.server.service.TemporaryPathCredentialsServiceTest"

# Spark connector endpoint support
./build/sbt "spark/testOnly io.unitycatalog.spark.UCSingleCatalogEndpointTest"
```

### Integration Tests with Real MinIO

If you have Docker installed:

```bash
# Start MinIO
docker run -d --name minio-test \
  -p 9000:9000 -p 9001:9001 \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=minioadmin \
  minio/minio:latest server /data --console-address ":9001"

# Run integration test
./build/sbt "server/testOnly io.unitycatalog.server.service.MinioIntegrationTest"

# Cleanup
docker stop minio-test && docker rm minio-test
```

## CI/CD Integration

### GitHub Actions

The repository includes a GitHub Actions workflow (`.github/workflows/minio-integration-test.yml`) that:

1. Runs on PRs affecting S3-related code
2. Starts MinIO as a service
3. Executes all MinIO integration tests
4. Uploads test reports on failure

### Running in Other CI Systems

For Jenkins, CircleCI, or other CI systems:

```yaml
# Example: CircleCI config
version: 2.1
jobs:
  minio-tests:
    docker:
      - image: cimg/openjdk:11.0
      - image: minio/minio:latest
        environment:
          MINIO_ROOT_USER: minioadmin
          MINIO_ROOT_PASSWORD: minioadmin
        command: server /data
    steps:
      - checkout
      - run:
          name: Run MinIO Tests
          command: ./bin/test-minio-integration
```

## Test Coverage

### Unit Tests

- **S3EndpointConfigurationTest**: Verifies endpoint configuration and credential vending
- **ServerPropertiesTest**: Tests loading S3 configurations with endpoints
- **TemporaryPathCredentialsServiceTest**: Validates authorization changes
- **UCSingleCatalogEndpointTest**: Tests Spark connector endpoint handling

### Integration Tests

- **MinioIntegrationTest**: Full end-to-end test with MinIO container
- **MinioNonAdminUserTest**: Tests complete permission model with MinIO

### Manual Tests

- `examples/minio-test/test-minio-integration.sh`: Interactive test script
- `examples/minio-test/test-permissions.sh`: Permission model demonstration

## Adding New Tests

When adding S3-compatible storage features:

1. Add unit tests for configuration changes
2. Update integration tests for end-to-end validation
3. Include the test class in `bin/test-minio-integration`
4. Update CI workflows if needed

## Debugging Test Failures

### Common Issues

1. **Port conflicts**: Ensure ports 9000/9001 are free
2. **Docker not available**: Some tests will be skipped
3. **Timeout issues**: Increase wait times for MinIO startup

### Enable Debug Logging

```bash
# For tests
./build/sbt "server/testOnly io.unitycatalog.server.service.MinioIntegrationTest" \
  -Dlogback.configurationFile=src/test/resources/logback-test.xml

# Set log level
export SBT_OPTS="-Dorg.slf4j.simpleLogger.defaultLogLevel=debug"
```

### Test Reports

Test reports are generated in:
- `server/target/test-reports/`
- `connectors/spark/target/test-reports/`

## Performance Considerations

- MinIO container startup takes ~5-10 seconds
- Use `@TestInstance(Lifecycle.PER_CLASS)` to reuse containers
- Consider using TestContainers' reuse feature for local development