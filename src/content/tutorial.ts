import { getConfig } from '@/config/app';

const config = getConfig();

export const tutorialMarkdown = `# ${config.app.icon} ${config.tutorial.title}

${config.tutorial.description}

---

## ${config.tutorial.howToAsk.title}
${config.tutorial.howToAsk.examples.map((example, index) =>
  index === 0 ? example : `- "${example}"`
).join('\n')}

---

## ${config.tutorial.mindMapping.title}

${config.tutorial.mindMapping.triggers.map(trigger => trigger).join('\n')}

---

## 回答逻辑

${config.tutorial.logic.map((logic, index) => `${index + 1}. ${logic}`).join('\n')}

---

## 注意事项

${config.tutorial.notes.map(note => `- ${note}`).join('\n')}

`;
