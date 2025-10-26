"use client";

import { Modal } from "antd";
import { Streamdown } from "streamdown";
import { tutorialMarkdown } from "@/content/tutorial";

interface TutorialModalProps {
  open: boolean;
  onClose: () => void;
}

export default function TutorialModal({ open, onClose }: TutorialModalProps) {
  return (
    <Modal open={open} onCancel={onClose} footer={null} title="使用教程" width={640}>
      <Streamdown controls={true}>{tutorialMarkdown}</Streamdown>
    </Modal>
  );
}

