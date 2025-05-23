import { NetworkSecurityGroup } from "@cdktf/provider-azurerm/lib/network-security-group";
import { NetworkSecurityRule } from "@cdktf/provider-azurerm/lib/network-security-rule";
import { AzurermProvider } from "@cdktf/provider-azurerm/lib/provider";
import { Subnet } from "@cdktf/provider-azurerm/lib/subnet";
import { SubnetNetworkSecurityGroupAssociation } from "@cdktf/provider-azurerm/lib/subnet-network-security-group-association";
import { VirtualNetwork } from "@cdktf/provider-azurerm/lib/virtual-network";
import { Construct } from "constructs";

interface SubnetConfig {
  name: string;
  cidr: string;
}

interface NSGRuleConfig {
  name: string;
  priority: number;
  direction: string;
  access: string;
  protocol: string;
  sourcePortRange: string;
  destinationPortRange: string;
  sourceAddressPrefix: string;
  destinationAddressPrefix: string;
}

interface AzureResourcesParams {
  resourceGroupName: string;
  location: string;
  vnetName: string;
  vnetAddressSpace: string;
  subnets: SubnetConfig[];
  nsgRules: NSGRuleConfig[];
}

export function createAzureVnetResources(
  scope: Construct,
  provider: AzurermProvider,
  params: AzureResourcesParams
) {
  // VNet
  const vnet = new VirtualNetwork(scope, "azureVnet", {
    provider: provider,
    name: params.vnetName,
    addressSpace: [params.vnetAddressSpace],
    location: params.location,
    resourceGroupName: params.resourceGroupName,
    timeouts: {
      create: "1h",
      update: "1h",
      delete: "1h",
    },
  });

  // NSG
  const nsg = new NetworkSecurityGroup(scope, "multicloudVpnNsg", {
    provider: provider,
    resourceGroupName: params.resourceGroupName,
    location: params.location,
    name: `${params.vnetName}-nsg`,
    timeouts: {
      create: "30m",
      update: "30m",
      delete: "30m",
    },
  });

  // NSG rule
  const nsgRules: NetworkSecurityRule[] = [];
  params.nsgRules.forEach((rule: NSGRuleConfig, _) => {
    const nsgRule = new NetworkSecurityRule(scope, `nsgRule-${rule.name}`, {
      provider: provider,
      resourceGroupName: params.resourceGroupName,
      networkSecurityGroupName: nsg.name,
      name: rule.name,
      priority: rule.priority,
      direction: rule.direction,
      access: rule.access,
      protocol: rule.protocol,
      sourcePortRange: rule.sourcePortRange,
      destinationPortRange: rule.destinationPortRange,
      sourceAddressPrefix: rule.sourceAddressPrefix,
      destinationAddressPrefix: rule.destinationAddressPrefix,
      dependsOn: [nsg],
      timeouts: {
        create: "30m",
        update: "30m",
        delete: "30m",
      },
    });
    nsgRules.push(nsgRule);
  });

  // Subnets
  const subnets: { [key: string]: Subnet } = {};
  const subnetAssociations: SubnetNetworkSecurityGroupAssociation[] = [];

  for (const subnetConfig of params.subnets) {
    const subnetResource = new Subnet(
      scope,
      `myAzureSubnet-${subnetConfig.name}`,
      {
        provider: provider,
        resourceGroupName: params.resourceGroupName,
        virtualNetworkName: vnet.name,
        name: `${params.vnetName}-${subnetConfig.name}`,
        addressPrefixes: [subnetConfig.cidr],
        dependsOn: [vnet],
        timeouts: {
          create: "30m",
          update: "30m",
          delete: "30m",
        },
      }
    );

    // NSG associate
    const nsgAssociation = new SubnetNetworkSecurityGroupAssociation(
      scope,
      `nsgAssociation-${subnetConfig.name}`,
      {
        provider: provider,
        subnetId: subnetResource.id,
        networkSecurityGroupId: nsg.id,
        dependsOn: [
          subnetResource,
          nsg,
          ...(subnetAssociations.length > 0
            ? [subnetAssociations[subnetAssociations.length - 1]]
            : []),
        ],
        timeouts: {
          read: "30m",
          create: "30m",
          delete: "30m",
        },
      }
    );

    subnets[subnetConfig.name] = subnetResource;
    subnetAssociations.push(nsgAssociation);
  }

  return {
    vnet,
    nsg,
    nsgRules,
    subnets,
    subnetAssociations,
    params,
  };
}
