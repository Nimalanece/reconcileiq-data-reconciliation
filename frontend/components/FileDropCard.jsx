import React from "react";
import { InboxOutlined, FileExcelOutlined, CheckCircleFilled } from "@ant-design/icons";
import { Button, Tag, Upload, message } from "antd";
import { formatFileSize, isSupportedFile } from "../utils/file";

const { Dragger } = Upload;
const supported = ".csv,.xlsx,.xls,.txt";

export default function FileDropCard({ side, file, preview, onFile, onClear }) {
  const isSource = side === "Source";

  return (
    <section className="file-card">
      <div className="file-card-heading">
        <div className={`source-icon ${isSource ? "source-blue" : "target-violet"}`}>
          <FileExcelOutlined />
        </div>
        <div>
          <div className="file-title">{side} dataset</div>
          <div className="file-subtitle">{isSource ? "Reference dataset" : "Dataset to reconcile"}</div>
        </div>
        {file && <Tag color="success" className="file-ready"><CheckCircleFilled /> Ready</Tag>}
      </div>
      {!file ? (
        <Dragger
          accept={supported}
          multiple={false}
          showUploadList={false}
          beforeUpload={(nextFile) => {
            if (!isSupportedFile(nextFile.name)) {
              message.error("Choose a CSV, Excel, or TXT file.");
              return Upload.LIST_IGNORE;
            }
            onFile(nextFile);
            return false;
          }}
          className="file-drop"
        >
          <p className="ant-upload-drag-icon"><InboxOutlined /></p>
          <p className="drop-title">Drop your file here</p>
          <p className="drop-caption">or click to browse · CSV, XLSX, XLS, TXT</p>
        </Dragger>
      ) : (
        <div className="file-details">
          <div className="file-detail-name" title={file.name}>{file.name}</div>
          <div className="file-detail-meta">
            <span>{formatFileSize(file.size)}</span>
            <span>{preview ? `${preview.record_count.toLocaleString()} records` : "Reading file…"}</span>
            <span>{new Date(file.lastModified).toLocaleDateString()}</span>
          </div>
          <Button type="link" danger onClick={onClear}>Remove file</Button>
        </div>
      )}
    </section>
  );
}
