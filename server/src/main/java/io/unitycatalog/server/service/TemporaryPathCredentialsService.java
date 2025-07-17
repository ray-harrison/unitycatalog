package io.unitycatalog.server.service;

import com.linecorp.armeria.common.HttpResponse;
import com.linecorp.armeria.server.annotation.ExceptionHandler;
import com.linecorp.armeria.server.annotation.Post;
import io.unitycatalog.server.auth.UnityCatalogAuthorizer;
import io.unitycatalog.server.auth.annotation.AuthorizeExpression;
import io.unitycatalog.server.exception.GlobalExceptionHandler;
import io.unitycatalog.server.model.GenerateTemporaryPathCredential;
import io.unitycatalog.server.model.PathOperation;
import io.unitycatalog.server.persist.SchemaRepository;
import io.unitycatalog.server.service.credential.CredentialContext;
import io.unitycatalog.server.service.credential.CloudCredentialVendor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Collections;
import java.util.Set;

import static io.unitycatalog.server.service.credential.CredentialContext.Privilege.SELECT;
import static io.unitycatalog.server.service.credential.CredentialContext.Privilege.UPDATE;

@ExceptionHandler(GlobalExceptionHandler.class)
public class TemporaryPathCredentialsService {
    private static final Logger LOGGER = LoggerFactory.getLogger(TemporaryPathCredentialsService.class);
    
    private final CloudCredentialVendor cloudCredentialVendor;
    private final UnityCatalogAuthorizer authorizer;
    private final SchemaRepository schemaRepository;

    public TemporaryPathCredentialsService(
            CloudCredentialVendor cloudCredentialVendor,
            UnityCatalogAuthorizer authorizer,
            SchemaRepository schemaRepository) {
        this.cloudCredentialVendor = cloudCredentialVendor;
        this.authorizer = authorizer;
        this.schemaRepository = schemaRepository;
    }

    @Post("")
    // Authorization: Allow any authenticated user to generate path credentials
    // The actual table/volume/model creation will check for appropriate permissions
    @AuthorizeExpression("#permit")
    public HttpResponse generateTemporaryPathCredential(
        GenerateTemporaryPathCredential generateTemporaryPathCredential) {
        
        LOGGER.debug("Generating temporary credentials for path: {} with operation: {}", 
            generateTemporaryPathCredential.getUrl(), 
            generateTemporaryPathCredential.getOperation());
            
        return HttpResponse.ofJson(
                cloudCredentialVendor.vendCredential(
                        generateTemporaryPathCredential.getUrl(),
                        pathOperationToPrivileges(generateTemporaryPathCredential.getOperation())));
    }

    private Set<CredentialContext.Privilege> pathOperationToPrivileges(PathOperation pathOperation) {
        return switch (pathOperation) {
            case PATH_READ -> Set.of(SELECT);
            case PATH_READ_WRITE, PATH_CREATE_TABLE -> Set.of(SELECT, UPDATE);
            case UNKNOWN_PATH_OPERATION -> Collections.emptySet();
        };
    }
}