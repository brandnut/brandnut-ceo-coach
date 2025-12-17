"use client";

import { useState } from "react";
import { Modal, Input, Button } from "antd";

interface FillInDialogProps {
  visible: boolean;
  question: string;
  onComplete: (filledQuestion: string) => void;
  onCancel: () => void;
}

export default function FillInDialog({
  visible,
  question,
  onComplete,
  onCancel,
}: FillInDialogProps) {
  const [userInput, setUserInput] = useState("");

  const handleOk = () => {
    if (userInput.trim()) {
      const filledQuestion = question.replace("...", userInput.trim());
      onComplete(filledQuestion);
      setUserInput("");
    }
  };

  const handleCancel = () => {
    onCancel();
    setUserInput("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleOk();
    }
  };

  return (
    <Modal
      open={visible}
      onOk={handleOk}
      onCancel={handleCancel}
      okText="确定"
      cancelText="取消"
      okButtonProps={{ disabled: !userInput.trim() }}
    >
      <div className="space-y-4">
        <p className="text-gray-600">{question}</p>
        <Input
          placeholder="您可以回忆真实情况，让 AI 更懂你"
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          onKeyPress={handleKeyPress}
          autoFocus
        />
      </div>
    </Modal>
  );
}