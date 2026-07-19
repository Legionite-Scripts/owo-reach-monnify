// Thin client for the owo-reach API. Every call goes through /api, which Vite
// proxies to the backend in dev (see vite.config.js) and which the backend
// serves itself alongside the built frontend in production — no CORS, ever.

const BASE = "/api";

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      ...options,
    });
  } catch {
    // fetch only throws on network-level failure (backend down, refused, DNS, etc.)
    throw new ApiError(
      "Can't reach the Owó Reach API. Make sure the backend is running on :3000.",
      0
    );
  }

  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    const message = data?.error || `Request failed (${res.status})`;
    throw new ApiError(message, res.status);
  }
  return data;
}

export const api = {
  health: () => request("/health"),

  listRuns: () => request("/runs"),
  createRun: (title, rawInput) =>
    request("/runs", { method: "POST", body: JSON.stringify({ title, rawInput }) }),
  getRun: (id) => request(`/runs/${id}`),
  approveRun: (id) => request(`/runs/${id}/approve`, { method: "POST" }),

  submitOtp: (beneficiaryId, otp) =>
    request(`/beneficiaries/${beneficiaryId}/otp`, {
      method: "POST",
      body: JSON.stringify({ otp }),
    }),
  resendOtp: (beneficiaryId) =>
    request(`/beneficiaries/${beneficiaryId}/otp/resend`, { method: "POST" }),
  revealPaycode: (beneficiaryId) =>
    request(`/beneficiaries/${beneficiaryId}/reveal`, { method: "POST" }),
  cancelBeneficiary: (beneficiaryId) =>
    request(`/beneficiaries/${beneficiaryId}/cancel`, { method: "POST" }),
  reissuePaycode: (beneficiaryId) =>
    request(`/beneficiaries/${beneficiaryId}/reissue`, { method: "POST" }),
  nudgeBeneficiary: (beneficiaryId) =>
    request(`/beneficiaries/${beneficiaryId}/nudge`, { method: "POST" }),

  listBanks: () => request("/banks"),
};
