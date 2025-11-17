import { Card, Typography, Button, Steps } from "antd";
import { ExclamationCircleOutlined } from "@ant-design/icons";
import { useApp } from "@/contexts/AppContext";

const { Title, Paragraph } = Typography;

interface FeatureUnavailableProps {
  onBack?: () => void;
}

export default function FeatureUnavailable({
  onBack,
}: FeatureUnavailableProps) {
  const { me, organizations, logout } = useApp();

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        padding: "20px",
        backgroundColor: "#f5f5f5",
      }}
    >
      <Card style={{ maxWidth: "400px", textAlign: "center" }}>
        <ExclamationCircleOutlined
          style={{ fontSize: "48px", color: "#faad14", marginBottom: "16px" }}
        />

        <Title level={4} style={{ marginBottom: "8px" }}>
          功能未开通
        </Title>

        <Paragraph style={{ color: "#666", marginBottom: "16px" }}>
          {me?.full_name || me?.username
            ? `${me?.full_name || me?.username}${
                organizations?.[0]?.name ? "，" : ""
              }`
            : ""}
          {organizations?.[0]?.name ? `您的组织 ${organizations[0].name} ` : ""}
          尚未开通 CEO 教练
        </Paragraph>

        {/* Service Steps */}
        <div style={{
          backgroundColor: "#fafafa",
          borderRadius: "8px",
          padding: "16px",
          marginBottom: "16px"
        }}>
          <style>{`
            .ant-steps-item-wait .ant-steps-item-title {
              color: #333 !important;
            }
          `}</style>
          <Steps
            direction="vertical"
            size="small"
            items={[
              {
                title: "深度访谈",
                status: "wait"
              },
              {
                title: "获得战略诊断报告",
                status: "wait"
              },
              {
                title: "AI CEO 教练开通",
                status: "wait"
              }
            ]}
          />
        </div>

        {/* Apply Button */}
        <Button
          type="primary"
          size="large"
          href="https://kcn07wjuhe5v.feishu.cn/share/base/form/shrcnJL83hAVYH1gQt2k1mpuOlh"
          target="_blank"
          style={{ width: "100%", marginBottom: "12px" }}
        >
          申请开通
        </Button>

        {/* Logout Button */}
        <Button
          size="large"
          onClick={async () => {
            await logout();
            window.location.href = "/login";
          }}
          style={{ width: "100%" }}
        >
          退出登录
        </Button>
      </Card>
    </div>
  );
}
