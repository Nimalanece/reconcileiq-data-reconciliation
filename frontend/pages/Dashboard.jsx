import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Avatar, Badge, Button, Card, Checkbox, Col, ConfigProvider, Dropdown, Empty, Layout,
  Menu, message, Progress, Row, Select, Space, Spin, Statistic, Tag, Tooltip, Typography, theme,
} from "antd";
import {
  ApiOutlined, BellOutlined, CheckCircleOutlined, ClockCircleOutlined, CloudUploadOutlined,
  DatabaseOutlined, FileSearchOutlined, FileTextOutlined, HomeOutlined, MoonOutlined,
  QuestionCircleOutlined, SettingOutlined, SunOutlined, SwapOutlined, UserOutlined,
} from "@ant-design/icons";
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip as ChartTooltip,
  XAxis, YAxis,
} from "recharts";
import { useNavigate } from "react-router-dom";
import FileDropCard from "../components/FileDropCard";
import PreviewTable from "../components/PreviewTable";
import ResultsTable from "../components/ResultsTable";
import brandMark from "../assets/brand-mark.svg";
import { compareFiles, downloadReport, getResults } from "../services/api";
import useFilePreview from "../hooks/useFilePreview";
import "../styles.css";

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;
const COLORS = ["#20b889", "#f28666"];

function MetricCard({ title, value, suffix, icon, color, footnote }) {
  return (
    <Card className="metric-card" variant="borderless">
      <div className="metric-top"><span>{title}</span><span className={`metric-icon ${color}`}>{icon}</span></div>
      <Statistic value={value} suffix={suffix} valueStyle={{ fontSize: 27, fontWeight: 700, color: "var(--text)" }} />
      <Text className="metric-footnote">{footnote}</Text>
    </Card>
  );
}

export default function Dashboard() {
  const [dark, setDark] = useState(false);
  const [source, setSource] = useState(null);
  const [target, setTarget] = useState(null);
  const [sourcePreview, setSourcePreview] = useState(null);
  const [targetPreview, setTargetPreview] = useState(null);
  const [keys, setKeys] = useState(["EMPID"]);
  const [options, setOptions] = useState({ ignore_case: false, ignore_whitespace: true, ignore_null_differences: false });
  const [comparison, setComparison] = useState(null);
  const [rows, setRows] = useState([]);
  const [columnDifferences, setColumnDifferences] = useState([]);
  const [totalResults, setTotalResults] = useState(0);
  const [loading, setLoading] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [filters, setFilters] = useState({ search: "", status: "", column: "", sort_by: "", descending: false });
  const [selected, setSelected] = useState([]);
  const [exporting, setExporting] = useState(false);
  const [toast, contextHolder] = message.useMessage();
  const { loadPreview } = useFilePreview();
  const navigate = useNavigate();

  const handleNavigation = ({ key }) => {
    const anchors = {
      overview: "workspace-overview",
      reconciliation: "datasets",
      sources: "datasets",
      reports: "results",
      settings: "comparison-settings",
      help: "workspace-overview",
    };
    navigate("/reconciliation");
    window.setTimeout(() => {
      document.getElementById(anchors[key] ?? "workspace-overview")?.scrollIntoView({ behavior: "smooth" });
    }, 0);
  };

  const columns = useMemo(() => {
    const sourceColumns = sourcePreview?.columns ?? [];
    return sourceColumns.filter((column) => targetPreview?.columns?.includes(column));
  }, [sourcePreview, targetPreview]);

  useEffect(() => {
    const key = keys[0];
    if (columns.length && (!key || !columns.includes(key))) {
      setKeys([columns.includes("EMPID") ? "EMPID" : columns[0]]);
    }
  }, [columns, keys]);

  const loadPage = useCallback(async (comparisonId, nextPage, activeFilters) => {
    setLoading(true);
    try {
      const result = await getResults(comparisonId, {
        offset: (nextPage - 1) * pageSize,
        limit: pageSize,
        ...activeFilters,
      });
      setRows(result.results);
      setTotalResults(result.total);
    } catch (error) {
      toast.error(error.response?.data?.detail ?? "Could not load comparison results.");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (comparison?.metadata?.comparison_id) loadPage(comparison.metadata.comparison_id, page, filters);
  }, [comparison, page, filters, loadPage]);

  const selectFile = async (side, file) => {
    if (side === "source") { setSource(file); setSourcePreview(null); }
    else { setTarget(file); setTargetPreview(null); }
    setComparison(null);
    try {
      const preview = await loadPreview(file);
      if (side === "source") setSourcePreview(preview);
      else setTargetPreview(preview);
    } catch (error) {
      if (side === "source") setSource(null);
      else setTarget(null);
      toast.error(error.response?.data?.detail ?? "Unable to read that file.");
    }
  };

  const runComparison = async () => {
    if (!source || !target) {
      toast.warning("Upload both source and target files to continue.");
      return;
    }
    if (!keys.length) {
      toast.warning("Choose at least one primary key.");
      return;
    }
    setComparing(true);
    setProgress(1);
    setSelected([]);
    try {
      const result = await compareFiles({
        source, target, primaryKeys: keys, options, onProgress: setProgress,
      });
      setProgress(100);
      setComparison(result);
      setColumnDifferences(result.column_differences ?? []);
      setPage(1);
      setFilters({ search: "", status: "", column: "", sort_by: "", descending: false });
      toast.success("Reconciliation completed successfully.");
    } catch (error) {
      toast.error(error.response?.data?.detail ?? "Comparison failed. Check the files and try again.");
    } finally {
      setComparing(false);
      setProgress(0);
    }
  };

  const exportFormat = async (format) => {
    if (!comparison) return;
    try {
      await downloadReport(comparison.metadata.comparison_id, format);
      toast.success(`${format.toUpperCase()} report downloaded.`);
    } catch {
      toast.error("Report download failed.");
    }
  };

  const exportSelected = async () => {
    if (!selected.length || !comparison) return;
    setExporting(true);
    try {
      await downloadReport(comparison.metadata.comparison_id, "xlsx", selected);
      toast.success("Selected rows exported.");
    } catch {
      toast.error("Could not export selected rows.");
    } finally {
      setExporting(false);
    }
  };

  const summary = comparison?.summary;
  const pieData = summary ? [
    { name: "Matched", value: summary.matched },
    { name: "Mismatched", value: summary.mismatched },
  ] : [];
  return (
    <ConfigProvider theme={{ algorithm: dark ? theme.darkAlgorithm : theme.defaultAlgorithm, token: { colorPrimary: "#3767e8", borderRadius: 10, fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" } }}>
      {contextHolder}
      <Layout className={`app-shell ${dark ? "dark-shell" : ""}`}>
        <Sider width={244} className="side-nav">
          <div className="brand-lockup">
            <img className="brand-mark" src={brandMark} alt="ReconcileIQ" />
            <div><div className="brand-name">reconcile<span>IQ</span></div><div className="brand-caption">DATA OPERATIONS</div></div>
          </div>
          <div className="nav-label">WORKSPACE</div>
          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={["reconciliation"]}
            onClick={handleNavigation}
            items={[
              { key: "overview", icon: <HomeOutlined />, label: "Overview" },
              { key: "reconciliation", icon: <SwapOutlined />, label: "Reconciliation" },
              { key: "sources", icon: <DatabaseOutlined />, label: "Data sources" },
              { key: "reports", icon: <FileTextOutlined />, label: "Reports" },
            ]}
          />
          <div className="sidebar-bottom">
            <div className="sidebar-status"><span className="live-dot" /> All systems operational</div>
            <Menu theme="dark" mode="inline" items={[
              { key: "settings", icon: <SettingOutlined />, label: "Settings" },
              { key: "help", icon: <QuestionCircleOutlined />, label: "Help center" },
            ]} />
            <div className="user-profile">
              <Avatar style={{ background: "#334b72" }} icon={<UserOutlined />} />
              <div className="user-copy"><strong></strong><span>Data Operations</span></div>
              <SettingOutlined className="profile-setting" />
            </div>
          </div>
        </Sider>
        <Layout className="workspace">
          <Header className="top-nav">
            <div className="breadcrumb">Workspace <span>/</span> <strong>Reconciliation</strong></div>
            <div className="top-actions">
              <Tooltip title={dark ? "Switch to light mode" : "Switch to dark mode"}>
                <Button type="text" icon={dark ? <SunOutlined /> : <MoonOutlined />} onClick={() => setDark(!dark)} />
              </Tooltip>
              <Button type="text" icon={<ApiOutlined />} />
              <Badge dot offset={[-3, 3]}><Button type="text" icon={<BellOutlined />} /></Badge>
              <Avatar size="small" style={{ background: "#dce7fb", color: "#3159a8" }}>AM</Avatar>
            </div>
          </Header>
          <Content className="main-content">
            <div className="page-heading" id="workspace-overview">
              <div>
                <div className="eyebrow">DATA QUALITY · RECONCILIATION</div>
                <Title level={2}>Reconciliation workspace</Title>
                <Text className="page-description">Validate, compare, and understand your data across systems.</Text>
              </div>
              <div className="run-meta"><ClockCircleOutlined /> Last run: {comparison ? new Date(comparison.metadata.timestamp).toLocaleString() : "Not run yet"}</div>
            </div>

            <section className="section-block" id="datasets">
              <div className="section-header">
                <div><div className="section-step">01 <span>·</span> CONNECT DATA</div><Title level={4}>Choose your datasets</Title></div>
                <Tag variant="filled" className="format-tag">CSV · XLSX · XLS · TXT</Tag>
              </div>
              <Row gutter={[18, 18]}>
                <Col xs={24} xl={12}><FileDropCard side="Source" file={source} preview={sourcePreview} onFile={(file) => selectFile("source", file)} onClear={() => { setSource(null); setSourcePreview(null); setComparison(null); }} /></Col>
                <Col xs={24} xl={12}><FileDropCard side="Target" file={target} preview={targetPreview} onFile={(file) => selectFile("target", file)} onClear={() => { setTarget(null); setTargetPreview(null); setComparison(null); }} /></Col>
              </Row>
            </section>

            {(sourcePreview || targetPreview) && (
              <section className="section-block" id="comparison-settings">
                <div className="section-header">
                  <div><div className="section-step">02 <span>·</span> INSPECT</div><Title level={4}>Data preview</Title></div>
                  <Text className="muted-copy">Preview the first 10 records before comparing</Text>
                </div>
                <Card className="surface-card preview-card" variant="borderless">
                  <PreviewTable source={source} target={target} sourcePreview={sourcePreview} targetPreview={targetPreview} />
                </Card>
              </section>
            )}

            <section className="section-block">
              <div className="section-header">
                <div><div className="section-step">03 <span>·</span> CONFIGURE</div><Title level={4}>Comparison settings</Title></div>
              </div>
              <Card className="surface-card settings-card" variant="borderless">
                <Row gutter={[24, 18]} align="middle">
                  <Col xs={24} lg={10}>
                    <label className="field-label">Primary key column(s)</label>
                    <Select
                      mode="multiple"
                      value={keys}
                      onChange={setKeys}
                      options={columns.map((column) => ({ value: column, label: column }))}
                      placeholder={columns.length ? "Select one or more key columns" : "Upload files to detect columns"}
                      disabled={!columns.length}
                      style={{ width: "100%" }}
                      maxTagCount="responsive"
                    />
                    <div className="field-hint"><CheckCircleOutlined /> {columns.length ? `${columns.length} shared columns auto-detected` : "Columns are detected after both uploads"}</div>
                  </Col>
                  <Col xs={24} lg={14}>
                    <div className="options-grid">
                      <Checkbox checked={options.ignore_case} onChange={(event) => setOptions({ ...options, ignore_case: event.target.checked })}>Ignore case</Checkbox>
                      <Checkbox checked={options.ignore_whitespace} onChange={(event) => setOptions({ ...options, ignore_whitespace: event.target.checked })}>Ignore whitespace</Checkbox>
                      <Checkbox checked={options.ignore_null_differences} onChange={(event) => setOptions({ ...options, ignore_null_differences: event.target.checked })}>Ignore null differences</Checkbox>
                    </div>
                  </Col>
                </Row>
                <div className="settings-footer">
                  <span><FileSearchOutlined /> Auto-detect columns enabled</span>
                  <Button type="primary" size="large" icon={comparing ? <Spin size="small" /> : <SwapOutlined />} onClick={runComparison} loading={comparing} disabled={!source || !target}>
                    {comparing ? "Comparing datasets…" : "Run comparison"}
                  </Button>
                </div>
                {comparing && <Progress percent={progress} status="active" showInfo strokeColor={{ "0%": "#3767e8", "100%": "#22b889" }} />}
              </Card>
            </section>

            {summary && (
              <>
                <section className="section-block results-overview" id="results">
                  <div className="section-header">
                    <div><div className="section-step">04 <span>·</span> RESULTS</div><Title level={4}>Run overview</Title></div>
                    <Dropdown menu={{ items: [
                      { key: "xlsx", label: "Excel workbook (.xlsx)", onClick: () => exportFormat("xlsx") },
                      { key: "csv", label: "Comma-separated (.csv)", onClick: () => exportFormat("csv") },
                      { key: "json", label: "JSON data (.json)", onClick: () => exportFormat("json") },
                      { key: "pdf", label: "PDF report (.pdf)", onClick: () => exportFormat("pdf") },
                    ] }}>
                      <Button icon={<CloudUploadOutlined />}>Export report</Button>
                    </Dropdown>
                  </div>
                  <Row gutter={[14, 14]}>
                    <Col xs={12} md={8} xl={4}><MetricCard title="Total records" value={summary.total_records.toLocaleString()} icon={<DatabaseOutlined />} color="blue" footnote="Unique keys across both files" /></Col>
                    <Col xs={12} md={8} xl={4}><MetricCard title="Matching" value={summary.matched.toLocaleString()} icon={<CheckCircleOutlined />} color="green" footnote="No differences detected" /></Col>
                    <Col xs={12} md={8} xl={4}><MetricCard title="Mismatched" value={summary.mismatched.toLocaleString()} icon={<SwapOutlined />} color="orange" footnote="Records with value changes" /></Col>
                    <Col xs={12} md={8} xl={4}><MetricCard title="Missing in source" value={summary.missing_source.toLocaleString()} icon={<FileSearchOutlined />} color="violet" footnote="Present only in target" /></Col>
                    <Col xs={12} md={8} xl={4}><MetricCard title="Missing in target" value={summary.missing_target.toLocaleString()} icon={<FileSearchOutlined />} color="red" footnote="Present only in source" /></Col>
                    <Col xs={12} md={8} xl={4}><MetricCard title="Success rate" value={summary.success_rate} suffix="%" icon={<CheckCircleOutlined />} color="teal" footnote="Matched records / total" /></Col>
                  </Row>
                  <Row gutter={[16, 16]} className="analytics-row">
                    <Col xs={24} lg={9}>
                      <Card className="surface-card chart-card" variant="borderless">
                        <div className="chart-heading"><div><strong>Match distribution</strong><span>Record-level outcome</span></div><Tag color="blue">Latest run</Tag></div>
                        {summary.total_records ? <div className="pie-wrap">
                          <ResponsiveContainer width="100%" height={205}>
                            <PieChart><Pie data={pieData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={82} paddingAngle={5}>
                              {pieData.map((entry, index) => <Cell key={entry.name} fill={COLORS[index]} />)}
                            </Pie><ChartTooltip /></PieChart>
                          </ResponsiveContainer>
                          <div className="chart-legend">{pieData.map((item, index) => <span key={item.name}><i style={{ background: COLORS[index] }} />{item.name}<b>{item.value.toLocaleString()}</b></span>)}</div>
                        </div> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No records to chart" />}
                      </Card>
                    </Col>
                    <Col xs={24} lg={15}>
                      <Card className="surface-card chart-card" variant="borderless">
                        <div className="chart-heading"><div><strong>Differences by column</strong><span>Count of changed values</span></div></div>
                        {columnDifferences.length ? (
                          <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={columnDifferences.slice(0, 12)} margin={{ top: 12, right: 12, left: -18, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--chart-grid)" />
                              <XAxis dataKey="column" tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
                              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
                              <ChartTooltip /><Bar dataKey="count" fill="#557bea" radius={[5, 5, 0, 0]} maxBarSize={38} />
                            </BarChart>
                          </ResponsiveContainer>
                        ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No column-level mismatches" />}
                      </Card>
                    </Col>
                  </Row>
                  <Card className="surface-card result-card" variant="borderless">
                    <div className="result-card-heading">
                      <div><strong>Difference detail</strong><span>{totalResults.toLocaleString()} exceptions detected</span></div>
                      <Space wrap>
                        {["xlsx", "csv", "json", "pdf"].map((format) => <Button key={format} size="small" onClick={() => exportFormat(format)} loading={exporting}>{format.toUpperCase()}</Button>)}
                      </Space>
                    </div>
                    <ResultsTable
                      rows={rows} total={totalResults} loading={loading} page={page} pageSize={pageSize}
                      onPage={setPage} onSearch={(search) => setFilters((old) => ({ ...old, search }))}
                      onStatus={(status) => setFilters((old) => ({ ...old, status: status ?? "" }))}
                      onColumn={(column) => setFilters((old) => ({ ...old, column }))}
                      onSort={(sort_by, descending) => setFilters((old) => ({ ...old, sort_by: sort_by ?? "", descending }))}
                      selected={selected} onSelected={setSelected}
                      onExportSelected={exportSelected}
                    />
                  </Card>
                  <Card className="surface-card metadata-card" variant="borderless">
                    <div className="metadata-heading"><FileTextOutlined /> Report metadata</div>
                    <Row gutter={[20, 12]}>
                      {[
                        ["Run timestamp", new Date(comparison.metadata.timestamp).toLocaleString()],
                        ["Source file", comparison.metadata.source_file_name],
                        ["Target file", comparison.metadata.target_file_name],
                        ["Records compared", summary.total_records.toLocaleString()],
                        ["Primary key", comparison.metadata.primary_keys.join(" + ")],
                        ["Execution duration", `${comparison.metadata.execution_duration_ms} ms`],
                      ].map(([label, value]) => <Col xs={24} sm={12} lg={8} key={label}><div className="metadata-item"><span>{label}</span><strong title={value}>{value}</strong></div></Col>)}
                    </Row>
                  </Card>
                </section>
              </>
            )}
            {!summary && <Card className="empty-run surface-card" variant="borderless">
              <div className="empty-run-icon"><DatabaseOutlined /></div>
              <Title level={4}>Your reconciliation results will appear here</Title>
              <Text>Upload source and target datasets, review your matching rules, then run a comparison.</Text>
            </Card>}
            <footer className="page-footer"><span>ReconcileIQ · Secure data validation workspace</span><span><span className="live-dot" /> All systems operational</span></footer>
          </Content>
        </Layout>
      </Layout>
    </ConfigProvider>
  );
}
