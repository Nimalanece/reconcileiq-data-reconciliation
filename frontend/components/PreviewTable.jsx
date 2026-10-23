import React from "react";
import { useMemo, useState } from "react";
import { Empty, Input, Select, Table, Tabs } from "antd";
import { SearchOutlined } from "@ant-design/icons";

function DataGrid({ title, rows = [], columns = [], accent }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState({});
  const filtered = useMemo(() => rows.filter((row) =>
    Object.values(row).some((value) => String(value ?? "").toLowerCase().includes(query.toLowerCase()))
  ), [rows, query]);
  const tableColumns = columns.map((column) => ({
    title: column,
    dataIndex: column,
    key: column,
    sorter: (a, b) => String(a[column] ?? "").localeCompare(String(b[column] ?? "")),
    sortOrder: sort.columnKey === column ? sort.order : null,
    ellipsis: true,
  }));

  return (
    <div className="preview-pane">
      <div className="preview-pane-header">
        <div className={`preview-dot ${accent}`} />
        <strong>{title}</strong>
        <span className="preview-row-count">{rows.length} rows</span>
      </div>
      <Input
        allowClear
        prefix={<SearchOutlined />}
        placeholder="Search preview rows"
        value={query}
        onChange={(event) => { setQuery(event.target.value); setPage(1); }}
        className="preview-search"
      />
      {columns.length ? (
        <Table
          size="small"
          columns={tableColumns}
          dataSource={filtered.map((row, index) => ({ ...row, __key: index }))}
          rowKey="__key"
          scroll={{ x: 480 }}
          pagination={{ current: page, pageSize: 5, onChange: setPage, showSizeChanger: false }}
          onChange={(_pagination, _filters, sorter) => setSort(sorter)}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No matching rows" /> }}
        />
      ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Upload a file to preview data" />}
    </div>
  );
}

export default function PreviewTable({ source, target, sourcePreview, targetPreview }) {
  const sourceColumns = sourcePreview?.columns ?? [];
  const targetColumns = targetPreview?.columns ?? [];
  return (
    <Tabs
      items={[
        { key: "source", label: `Source preview${source ? ` · ${sourcePreview?.record_count ?? "…"}` : ""}`, children: <DataGrid title="Source · first 10 rows" rows={sourcePreview?.rows} columns={sourceColumns} accent="blue" /> },
        { key: "target", label: `Target preview${target ? ` · ${targetPreview?.record_count ?? "…"}` : ""}`, children: <DataGrid title="Target · first 10 rows" rows={targetPreview?.rows} columns={targetColumns} accent="violet" /> },
      ]}
    />
  );
}
