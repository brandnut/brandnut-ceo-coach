import { Card, Typography, Button, Steps } from "antd";
import { ExclamationCircleOutlined } from "@ant-design/icons";
import { useApp } from "@/contexts/AppContext";
import { featureUnavailableTexts } from "@/lib/styles";

const { Title, Paragraph } = Typography;

interface FeatureUnavailableProps {
  onBack?: () => void;
  type?: 'no_feature' | 'no_permission' | 'no_organization';
}

export default function FeatureUnavailable({
  onBack,
  type = 'no_feature',
}: FeatureUnavailableProps) {
  const { me, organizations, logout } = useApp();

  // 准备用户和组织信息
  const userName = me?.full_name || me?.username || '';
  const orgName = organizations?.[0]?.name || '';

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        padding: "20px",
        background: 'var(--brandnut-bg-gradient)',
      }}
    >
      <Card style={{ maxWidth: "400px", textAlign: "center" }}>
        <ExclamationCircleOutlined
          style={{ fontSize: "48px", color: "#faad14", marginBottom: "16px" }}
        />

        <Title level={4} style={{ marginBottom: "8px" }}>
          {featureUnavailableTexts.titles[type]}
        </Title>

        <Paragraph style={{ color: "#666", marginBottom: "16px" }}>
          {type === 'no_organization'
            ? featureUnavailableTexts.messages.no_organization(userName)
            : featureUnavailableTexts.messages[type](userName, orgName)
          }
        </Paragraph>

        {type === 'no_feature' && (
          <>
            {/* Service Steps */}
            <div
              style={{
                backgroundColor: "#fafafa",
                borderRadius: "8px",
                padding: "16px",
                marginBottom: "16px",
              }}
            >
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
                    title: featureUnavailableTexts.steps.interview,
                    status: "wait",
                  },
                  {
                    title: featureUnavailableTexts.steps.report,
                    status: "wait",
                  },
                  {
                    title: featureUnavailableTexts.steps.coach,
                    status: "wait",
                  },
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
              {featureUnavailableTexts.buttons.apply_interview}
            </Button>
          </>
        )}

        {/* Logout Button */}
        <Button
          size="large"
          onClick={async () => {
            await logout();
            window.location.href = "/login";
          }}
          style={{ width: "100%" }}
        >
          {featureUnavailableTexts.buttons.logout}
        </Button>
      </Card>
    </div>
  );
}
