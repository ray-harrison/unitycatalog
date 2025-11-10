# Deployment

This guide outlines how to deploy the Unity Catalog server.

## Deploying using tarball

### Prerequisites

- To generate the tarball, run the following command in the source code:

    ```sh
    build/sbt createTarball
    ```

### Unpacking the tarball

- The tarball generated in the `target` directory can be unpacked using the following command:

    ```sh
    tar -xvf unitycatalog-<version>.tar.gz
    ```

- Unpacking the tarball will create the following directory structure:

    ```console
    unitycatalog-<version>
    ├── bin
    │   ├── start-uc-server
    │   └── uc
    ├── etc
    │   ├── conf
    │   ├── data
    │   ├── db
    │   └── logs
    └── jars
    ```

- The `bin` directory contains the scripts that you can use to start the UC server and run the CLI.
- The `etc` directory contains the configuration, data, database, and logs directories.
- The `jars` directory contains the jar files required to run the UC server.

### Configuring the UC server

- The UC server can be configured by modifying the files in `etc/conf/`. This includes properties related to logging,
    server environment and the s3 configuration.
- Setting the server environment to `dev` will use properties located in `etc/conf/hibernate.properties` to configure
    the backend database whereas `test` will spin up an in-memory database.
- The `etc/data/` directory contains the data files that are used by the UC server. This includes the tables and volumes
    that are created.
- The `etc/db/` directory contains the backend database that is used by the UC server.

### Configuring the database

- The backend database can be configured by modifying the `etc/conf/hibernate.properties` file.
- You need to provide the connection details to connect to your database server.

### Example MySQL Connection

#### Prerequisites

- Install docker.
- Download JDBC driver for [MySQL](https://dev.mysql.com/downloads/connector/j/).

#### Start MySQL server

- In a terminal, navigate to the cloned repository root directory.
- Modify `etc/db/mysql-example.yml` to configure MySQL server. Then start MySQL using Docker:

    ```sh
    docker-compose -f etc/db/mysql-example.yml up -d
    ```

- Modify the `etc/conf/hibernate.properties` file with your MySQL connection details:

    ```properties
    hibernate.connection.driver_class=com.mysql.cj.jdbc.Driver
    hibernate.connection.url=jdbc:mysql://localhost:3306/ucdb
    hibernate.connection.user=uc_default_user
    hibernate.connection.password=uc_default_password
    ```

- Modify the `jars/classpath` file and add path to your JDBC driver.

### Example PostgreSQL Connection

#### Prerequisites

- Install docker.
- Download JDBC driver for [PostgreSQL](https://jdbc.postgresql.org/download/).

#### Start PostgreSQL server

- In a terminal, navigate to the cloned repository root directory.
- Modify `etc/db/postgres-example.yml` to configure PostgreSQL server. Then start PostgreSQL using Docker:

    ```sh
    docker-compose -f etc/db/postgres-example.yml up -d
    ```

- Modify the `etc/conf/hibernate.properties` file with your PostgreSQL connection details:

    ```properties
    hibernate.connection.driver_class=org.postgresql.Driver
    hibernate.connection.url=jdbc:postgresql://localhost:5432/ucdb
    hibernate.connection.user=uc_default_user
    hibernate.connection.password=uc_default_password
    ```

- Modify the `jars/classpath` file and add path to your jdbc driver.

## Configuring Admin Bootstrap

When deploying Unity Catalog with authentication enabled, you can configure automatic admin privilege grants for initial
administrators. This eliminates the need to manually grant METASTORE OWNER privileges using the admin token.

### Using .local files for secure configuration

For production deployments, use `.local` configuration files to keep sensitive data out of version control:

1. Create a local configuration file:

    ```sh
    cp etc/conf/server.properties.local.example etc/conf/server.properties.local
    ```

2. Edit `etc/conf/server.properties.local` with your admin email addresses:

    ```properties
    # Specific admin users
    server.bootstrap.admin-emails=admin@yourcompany.com,dba@yourcompany.com

    # OR grant admin to entire domain
    server.bootstrap.admin-email-domains=@yourcompany.com
    ```

3. Verify the `.local` file is not tracked by git (`.local` files are automatically git-ignored)

Properties in `.local` files automatically override properties in the base configuration files.

### Admin bootstrap behavior

- Admin privileges (METASTORE OWNER) are granted **only on first authentication** (user creation)
- Works with Azure AD, Google Identity, or any OIDC provider
- Email matching is case-insensitive
- Removing users from allowlist does **not** revoke existing privileges

For detailed configuration options and examples, see [Authentication and Authorization](server/auth.md#admin-bootstrap-via-email-allowlist).
