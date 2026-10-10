import { useState } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import {
  CheckCircle2,
  Copy,
  Download,
  FileSpreadsheet,
  Share2,
} from "lucide-react-native";

import {
  Button,
  Card,
  ErrorState,
  ScreenHeader,
} from "../../../../components/ui";
import {
  copyReportToClipboard,
  exportReportCsv,
  REPORT_KINDS,
  type ReportKind,
} from "../../../../lib/api/reports";

export default function ReportsScreen() {
  const [selectedKind, setSelectedKind] = useState<ReportKind>("locations");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportedCsv, setExportedCsv] = useState<string | null>(null);
  const [sharedSuccess, setSharedSuccess] = useState(false);
  const [copied, setCopied] = useState(false);

  const selectedReportInfo = REPORT_KINDS.find((r) => r.id === selectedKind);

  const handleExport = async () => {
    setLoading(true);
    setError(null);
    setSharedSuccess(false);
    setCopied(false);
    try {
      const result = await exportReportCsv(selectedKind);
      if (result.shared) {
        setSharedSuccess(true);
        setExportedCsv(null);
      } else {
        // Sharing unavailable or cancelled, show raw CSV fallback
        setExportedCsv(result.csvText);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to generate report";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!exportedCsv) return;
    await copyReportToClipboard(exportedCsv);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <View className="flex-1 bg-surface">
      <ScreenHeader
        title="Reports & Export"
        subtitle="Download and share system data in CSV format"
        showBack
      />

      <ScrollView
        className="flex-1"
        contentContainerClassName="p-4 gap-5 pb-16"
      >
        {/* Report Selector Header */}
        <View className="gap-1.5">
          <Text className="text-base font-bold text-ink">Select Dataset</Text>
          <Text className="text-sm text-ink-muted">
            Choose which operational resource to export as comma-separated values.
          </Text>
        </View>

        {/* Report Cards / Picker */}
        <View className="gap-2.5">
          {REPORT_KINDS.map((report) => {
            const isSelected = selectedKind === report.id;
            return (
              <Card
                key={report.id}
                onPress={() => {
                  setSelectedKind(report.id);
                  setExportedCsv(null);
                  setSharedSuccess(false);
                  setError(null);
                }}
                className={`flex-row items-center justify-between border ${
                  isSelected
                    ? "border-brand-green bg-brand-green/5"
                    : "border-border bg-surface"
                }`}
              >
                <View className="flex-1 pr-3 gap-1">
                  <View className="flex-row items-center gap-2">
                    <FileSpreadsheet
                      size={18}
                      color={isSelected ? "#0E4429" : "#5B6B60"}
                    />
                    <Text
                      className={`text-base font-bold ${
                        isSelected ? "text-brand-green" : "text-ink"
                      }`}
                    >
                      {report.label}
                    </Text>
                  </View>
                  <Text className="text-xs text-ink-muted">
                    {report.description}
                  </Text>
                </View>

                <View
                  className={`h-5 w-5 rounded-full border items-center justify-center ${
                    isSelected
                      ? "border-brand-green bg-brand-green"
                      : "border-border"
                  }`}
                >
                  {isSelected ? (
                    <View className="h-2 w-2 rounded-full bg-white" />
                  ) : null}
                </View>
              </Card>
            );
          })}
        </View>

        {/* Export Action Card */}
        <Card className="gap-3 bg-muted/20 border-border">
          <View className="flex-row items-center gap-2">
            <Download size={20} color="#0E4429" />
            <Text className="text-base font-bold text-ink">
              Export {selectedReportInfo?.label} CSV
            </Text>
          </View>
          <Text className="text-sm text-ink-muted">
            Generates a standard RFC 4180 CSV file containing all recent records.
            The OS share dialog will let you save to Files, AirDrop, Email, or Slack.
          </Text>

          <Button
            label={loading ? "Generating CSV..." : "Export & Share CSV"}
            variant="primary"
            loading={loading}
            icon={<Share2 size={18} color="#FFFFFF" />}
            onPress={handleExport}
            className="mt-1"
          />
        </Card>

        {/* Error State */}
        {error ? (
          <ErrorState
            title="Export Failed"
            description={error}
            onRetry={handleExport}
            retryLabel="Retry Export"
          />
        ) : null}

        {/* Success Banner */}
        {sharedSuccess ? (
          <Card className="flex-row items-center gap-3 border-success/30 bg-success/10">
            <CheckCircle2 size={24} color="#1B6B3F" />
            <View className="flex-1">
              <Text className="text-sm font-bold text-success">
                Export shared successfully!
              </Text>
              <Text className="text-xs text-ink-muted">
                The {selectedReportInfo?.label} CSV file was processed and exported.
              </Text>
            </View>
          </Card>
        ) : null}

        {/* Fallback Monospace CSV Viewer */}
        {exportedCsv ? (
          <Card className="gap-3 border-border">
            <View className="flex-row items-center justify-between border-b border-border pb-2">
              <Text className="text-sm font-bold text-ink">CSV Preview</Text>
              <Pressable
                onPress={handleCopy}
                accessibilityRole="button"
                accessibilityLabel="Copy CSV text to clipboard"
                className="flex-row items-center gap-1.5 rounded-pill bg-brand-green px-3 py-1.5 active:bg-brand-green-light"
              >
                {copied ? (
                  <>
                    <CheckCircle2 size={14} color="#FFFFFF" />
                    <Text className="text-xs font-semibold text-white">Copied!</Text>
                  </>
                ) : (
                  <>
                    <Copy size={14} color="#FFFFFF" />
                    <Text className="text-xs font-semibold text-white">
                      Copy to Clipboard
                    </Text>
                  </>
                )}
              </Pressable>
            </View>

            <ScrollView
              horizontal
              nestedScrollEnabled
              className="max-h-80 rounded-card bg-muted/60 p-3"
            >
              <Text
                selectable
                className="font-mono text-xs text-ink"
                style={{ fontFamily: "monospace" }}
              >
                {exportedCsv}
              </Text>
            </ScrollView>
            <Text className="text-[11px] text-ink-muted">
              Displaying raw text because native sharing was unavailable or closed.
            </Text>
          </Card>
        ) : null}
      </ScrollView>
    </View>
  );
}
