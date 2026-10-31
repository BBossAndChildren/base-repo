import type {Selection} from './client.js';
export interface DeploymentInputs {
  siteUrl: string;
  manifest: {build:{build_id:string};supported:Selection[]};
  sessionId: string;
  endpoints: {eventEndpoint?:string;reconcileEndpoint?:string;heartbeatEndpoint?:string;interruptionEndpoint?:string;credentials?:RequestCredentials;headers?:()=>Record<string,string>|Promise<Record<string,string>>};
}
// Supply actual service configuration. This type does not create endpoints, credentials, ownership leases or server admission.
