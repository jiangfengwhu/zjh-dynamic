/** 工坊可以交给哪一家 AI Agent。新增时在这里补一项。 */
export type AgentProvider = {
  id: string;
  name: string;
  hint: string;
};

export const AGENT_PROVIDERS: AgentProvider[] = [
  { id: "jules", name: "Jules", hint: "在云端改代码并打包" },
];
