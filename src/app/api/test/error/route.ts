import { NextResponse } from 'next/server'

export async function GET() {
  // 故意触发各种类型的错误来测试 ARMS

  // 1. JavaScript Error
  // throw new Error('Test error for ARMS monitoring')

  // 2. Promise rejection
  // await Promise.reject(new Error('Test promise rejection'))

  // 3. Type error
  // const obj: any = null
  // console.log(obj.xyz.abc)

  // 4. Reference error
  // @ts-ignore - 故意触发未定义变量错误
  console.log(undefinedVariable.test)

  return NextResponse.json({ message: 'This should never be reached' })
}
