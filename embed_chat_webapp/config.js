export const APP_CONFIG = {
  orchestrate: {
    orchestrationID: process.env.NEXT_PUBLIC_ORCHESTRATE_ORCHESTRATIONID,
    hostURL: process.env.NEXT_PUBLIC_ORCHESTRATE_HOSTURL,
    crn: process.env.NEXT_PUBLIC_ORCHESTRATE_CRN,
    agentId: process.env.NEXT_PUBLIC_ORCHESTRATE_AGENT_ID,
    agentEnvironmentId: process.env.NEXT_PUBLIC_ORCHESTRATE_AGENT_ENVIRONMENT_ID,
  },
};