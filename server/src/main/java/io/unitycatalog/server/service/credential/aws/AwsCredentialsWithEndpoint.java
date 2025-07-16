package io.unitycatalog.server.service.credential.aws;

import lombok.Builder;
import lombok.Getter;
import software.amazon.awssdk.services.sts.model.Credentials;

@Getter
@Builder
public class AwsCredentialsWithEndpoint {
  private final Credentials credentials;
  private final String serviceEndpoint;
}
