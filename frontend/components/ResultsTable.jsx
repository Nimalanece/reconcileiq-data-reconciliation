import React, { useState } from "react";
import { Button, Input, Select, Space, Table, Tag } from "antd";
import { DownloadOutlined, SearchOutlined } from "@ant-design/icons";

export default function ResultsTable({
  rows, total, loading, page, pageSize, onPage, onSearch, onStatus, onColumn, onSort,
  selected, onSelected, onExportSelected,
}) {
  const [query, setQuery] = useState("");
  const columns = [
    { title: "Primary key", dataIndex: "PRIMARY_KEY", key: "PRIMARY_KEY", sorter: true, width: 150 },
    { title: "Column", dataIndex: "COLUMN", key: "COLUMN", sorter: true, width: 160 },
    { title: "Source value", dataIndex: "SOURCE_VALUE", key: "SOURCE_VALUE", sorter: true, ellipsis: true },
    { title: "Target value", dataIndex: "TARGET_VALUE", key: "TARGET_VALUE", sorter: true, ellipsis: true },
    {
      title: "Status", dataIndex: "STATUS", key: "STATUS", sorter: true, width: 160,
      render: (value) => <Tag color={value === "Mismatched" ? "error" : value === "Matched" ? "success" : "warning"}>{value}</Tag>,
    },
    { title: "Difference type", dataIndex: "DIFFERENCE_TYPE", key: "DIFFERENCE_TYPE", width: 160 },
  ];
  return (
    <>
      <div className="results-toolbar">
        <Space wrap>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Search keys and values"
            value={query}
            onChange={(event) => { setQuery(event.target.value); onSearch(event.target.value); onPage(1); }}
            style={{ width: 235 }}
          />
          <Select
            allowClear
            placeholder="All statuses"
            onChange={(value) => { onStatus(value); onPage(1); }}
            options={["Mismatched", "Missing in Source", "Missing in Target"].map((value) => ({ value, label: value }))}
            style={{ width: 175 }}
          />
          <Input
            allowClear
            placeholder="Filter column"
            onChange={(event) => { onColumn(event.target.value); onPage(1); }}
            style={{ width: 150 }}
          />
        </Space>
        <Button icon={<DownloadOutlined />} disabled={!selected.length} onClick={onExportSelected}>
          Export selected ({selected.length})
        </Button>
      </div>
      <Table
        className="results-table"
        rowKey="__row_id"
        size="middle"
        columns={columns}
        dataSource={rows}
        loading={loading}
        rowSelection={{ selectedRowKeys: selected, onChange: onSelected }}
        scroll={{ x: 900 }}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: false,
          showTotal: (count, range) => `${range[0]}–${range[1]} of ${count} differences`,
          onChange: onPage,
        }}
        onChange={(_pagination, _filters, sorter) => {
          const active = Array.isArray(sorter) ? sorter[0] : sorter;
          onSort(active?.columnKey, active?.order === "descend");
        }}
      />
    </>
  );
}
