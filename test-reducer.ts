/**
 * Test script for LangGraph agent refactoring
 * Tests that the message reducer works correctly
 */

import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages'

// Test reducer logic
function testReducerLogic() {
  console.log('=== Testing LangGraph Message Reducer ===\n')

  const reducer = (x: any[], y: any[]) => {
    if (y.length > 0 && y[0]._getType() === 'system') {
      return y // Replace (preprocess)
    }
    return x.concat(y) // Append (agent/tools)
  }

  let passCount = 0
  let failCount = 0

  // Test 1: Replace when new messages start with SystemMessage
  console.log('Test 1: Preprocess (should replace)')
  const existing1 = [new HumanMessage('original')]
  const new1 = [new SystemMessage('system'), new HumanMessage('augmented')]
  const result1 = reducer(existing1, new1)

  console.log('  Input:  [human]')
  console.log('  Add:    [system, human]')
  console.log('  Result:', result1.map((m: any) => m._getType()).join(', '))
  console.log('  Expected: [system, human]')

  if (result1.length === 2 && result1[0]._getType() === 'system') {
    console.log('  ✓ PASS\n')
    passCount++
  } else {
    console.log('  ✗ FAIL\n')
    failCount++
  }

  // Test 2: Append when new messages don't start with SystemMessage
  console.log('Test 2: Agent (should append)')
  const existing2 = [new SystemMessage('system'), new HumanMessage('augmented')]
  const new2 = [new AIMessage('response')]
  const result2 = reducer(existing2, new2)

  console.log('  Input:  [system, human]')
  console.log('  Add:    [ai]')
  console.log('  Result:', result2.map((m: any) => m._getType()).join(', '))
  console.log('  Expected: [system, human, ai]')

  if (result2.length === 3 && result2[2]._getType() === 'ai') {
    console.log('  ✓ PASS\n')
    passCount++
  } else {
    console.log('  ✗ FAIL\n')
    failCount++
  }

  // Test 3: Multiple appends (tool loop)
  console.log('Test 3: Tool loop (should keep appending)')
  let messages = [new SystemMessage('system'), new HumanMessage('search')]

  messages = reducer(messages, [new AIMessage('I will search')])
  console.log('  After agent: [system, human, ai]')

  const mockTool = { _getType: () => 'tool' } as any
  messages = reducer(messages, [mockTool])
  console.log('  After tool:  [system, human, ai, tool]')

  messages = reducer(messages, [new AIMessage('Based on search...')])
  console.log('  After agent: [system, human, ai, tool, ai]')

  if (messages.length === 5) {
    console.log('  ✓ PASS\n')
    passCount++
  } else {
    console.log('  ✗ FAIL\n')
    failCount++
  }

  // Summary
  console.log('=== Summary ===')
  console.log(`Total: ${passCount + failCount}`)
  console.log(`Pass: ${passCount}`)
  console.log(`Fail: ${failCount}`)
  console.log()

  if (failCount === 0) {
    console.log('✓ All tests passed! Reducer logic is correct.')
  } else {
    console.log('✗ Some tests failed. Reducer logic needs fixing.')
  }
}

// Run tests
testReducerLogic()
