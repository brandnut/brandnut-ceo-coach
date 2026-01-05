import { Annotation, StateGraph } from '@langchain/langgraph'
import { BaseMessage } from '@langchain/core/messages'

export interface AgentState {
  messages: BaseMessage[]
}

export const agentStateAnnotation = Annotation<AgentState>({
  messages: Annotation<BaseMessage[]>({
    reducer: (_, y) => y,
    default: () => [],
  }),
})
