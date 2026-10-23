import axios from "axios";

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000/api",
});

export async function previewFile(file) {
  const data = new FormData();
  data.append("file", file);
  return (await client.post("/preview", data)).data;
}

export async function compareFiles({ source, target, primaryKeys, options, onProgress }) {
  const data = new FormData();
  data.append("source", source);
  data.append("target", target);
  data.append("primary_keys", JSON.stringify(primaryKeys));
  Object.entries(options).forEach(([key, value]) => data.append(key, String(value)));
  return (await client.post("/compare", data, {
    onUploadProgress: (event) => {
      if (event.total) onProgress?.(Math.min(95, Math.round((event.loaded / event.total) * 95)));
    },
  })).data;
}

export async function getResults(comparisonId, params) {
  return (await client.get(`/comparisons/${comparisonId}/results`, { params })).data;
}

export async function downloadReport(comparisonId, format, selected = []) {
  const params = selected.length ? { selected: selected.join(",") } : {};
  const response = await client.get(`/comparisons/${comparisonId}/report/${format}`, {
    params,
    responseType: "blob",
  });
  const url = URL.createObjectURL(response.data);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `reconciliation_report.${format}`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
