# MinIO S3 Compatibility Test

This directory contains tests to verify that Unity Catalog works correctly with S3-compatible storage systems like MinIO.

## Prerequisites

- Docker and Docker Compose
- Java 11+
- Apache Spark 3.5.3+
- Unity Catalog built and ready to run

## Quick Test

Run the automated test script:

```bash
./test-minio-integration.sh
```

This script will:
1. Start MinIO in a Docker container
2. Configure Unity Catalog server to use MinIO
3. Run Spark commands to create tables and read/write data
4. Verify the integration works correctly

## Manual Testing

### 1. Start MinIO

```bash
docker-compose up -d
```

MinIO will be available at:
- API: http://localhost:9000
- Console: http://localhost:9001 (login: minioadmin/minioadmin)

### 2. Configure Unity Catalog

Edit `etc/conf/server.properties`:

```properties
# MinIO S3 Configuration
s3.bucketPath.0=s3://test-bucket
s3.region.0=us-east-1
s3.accessKey.0=minioadmin
s3.secretKey.0=minioadmin
s3.serviceEndpoint.0=http://localhost:9000
```

### 3. Start Unity Catalog Server

```bash
bin/start-uc-server
```

### 4. Test with Spark

Start Spark with Unity Catalog:

```bash
bin/spark-sql \
  --packages "io.delta:delta-spark_2.13:4.0.0,io.unitycatalog:unitycatalog-spark_2.13:0.3.0" \
  --conf "spark.sql.extensions=io.delta.sql.DeltaSparkSessionExtension" \
  --conf "spark.sql.catalog.unity=io.unitycatalog.spark.UCSingleCatalog" \
  --conf "spark.sql.catalog.unity.uri=http://localhost:8080" \
  --conf "spark.sql.catalog.unity.token=" \
  --conf "spark.sql.defaultCatalog=unity"
```

Create and test a table:

```sql
-- Create external table pointing to MinIO
CREATE TABLE unity.default.minio_test (
  id INT,
  name STRING
) USING parquet
LOCATION 's3://test-bucket/minio_test';

-- Insert data
INSERT INTO unity.default.minio_test VALUES 
  (1, 'Alice'),
  (2, 'Bob'),
  (3, 'Charlie');

-- Query data
SELECT * FROM unity.default.minio_test;

-- Cleanup
DROP TABLE unity.default.minio_test;
```

## Debugging

### Check MinIO Logs
```bash
docker logs minio-test_minio_1
```

### Verify Bucket Contents
Visit http://localhost:9001 and login with minioadmin/minioadmin

### Enable Debug Logging

For Unity Catalog server, add to logback.xml:
```xml
<logger name="io.unitycatalog.server.service.credential" level="DEBUG"/>
```

For Spark, add:
```
--conf "spark.sql.debug=true"
```

## Common Issues

1. **Connection Refused**: Ensure MinIO is running and accessible
2. **Access Denied**: Check MinIO credentials in server.properties
3. **Path Style Access**: The implementation automatically enables path-style access for custom endpoints

## Integration Test

The Java integration test (`MinioS3CompatibilityTest.java`) provides automated testing using TestContainers. Run it with:

```bash
mvn test -Dtest=MinioS3CompatibilityTest
```