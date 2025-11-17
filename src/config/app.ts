import { getRandomQuestions } from "@/lib/ceo-questions";

export const tutorialMarkdown = `# 👋 欢迎使用品核 AI —— CEO 教练

**CEO 教练**是一位懂战略、懂企业、懂你的顾问。  
它不是为了给你答案，而是帮你**理清问题、看清结构、做出更稳的判断**。

---

## 怎么用
1. 💬 **直接开聊**  
   无需模板或复杂提示词，直接说出你当下的想法：  
   > “我在想该不该调整明年的品牌方向。”  
   
   它会一步步帮你厘清逻辑、看见关键变量。

2. 📚 **已经了解你的企业**  
   它已读取你与 **品核 AI** 进行的深度访谈、先前提供的企业资料
   包括企业背景、品牌故事、团队架构与经营数据，  
   从而提供贴合实际语境的分析，而非泛泛建议。

3. 🧠 **有记忆，会进化**  
   它能记住你在对话中提到的事实与偏好，  
   理解你的表达方式与思考习惯，  
   随时间推移，越来越懂你和你的企业，是你的长期顾问。
   可以尝试告诉它：
   > 你喜欢的书籍、商业 IP、公司

   > 你团队的情况

   > 你的目标

4. 🌐 **实时联网，保持判断的新鲜度**  
   当你提到行业趋势、竞争格局或政策变化时，  
   它会自动联网搜索最新信息，  
   让你的决策建立在**实时数据与动态洞察**之上。

5. 📎 **支持文件分析，提升深度对话**  
   在对话过程中，你可以随时上传文件，  
   如方案、报告、会议纪要、复盘文档等，  
   CEO 教练会帮你从中抽出结构、问题与决策启示。

---

## 它能带来什么
- 让复杂问题变得有结构  
- 把直觉转化为可验证的判断  
- 让战略、团队与自我决策重新对齐  
- 进化出你专属的思考系统

---

## 可以这样开始
> “我们是不是该缩减渠道投入？”  
> “团队现在的冲突，本质问题是什么？”  
> “我觉得自己在战略判断上越来越谨慎，这是好事吗？”

`;

export const welcomeQuestions = getRandomQuestions(3).map(item => item.question);

export const welcomeText = {
   greeting: "👋",
   startNewConversation: "开始新对话",
   suggestedQuestionsTitle: "您可以尝试询问以下问题：",
};

export const difyInputs = {
   // Dify 变量配置
   // 例如: { industry: "technology", region: "global" }
};

export const guestMode = {
   enabled: false,
   username: "guest",
   autoSignIn: true,
};

export const appInfo = {
   name: "品核 AI CEO 教练",
   title: "品核 AI CEO 教练",
   description: "释放品牌真潜能、企业级记忆协同",
};