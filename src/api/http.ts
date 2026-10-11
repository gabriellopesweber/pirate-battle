import axios, { type AxiosInstance } from 'axios'

/** Served by MSW in every environment, the deployed build included — there is no real backend. */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api'

/** Past this a request fails as a timeout, and the query layer decides whether to retry. */
export const API_TIMEOUT_MS = 5_000

export function createHttp(baseURL: string = API_BASE_URL): AxiosInstance {
  return axios.create({ baseURL, timeout: API_TIMEOUT_MS })
}

/** The app's only Axios instance; no other module configures HTTP. */
export const http = createHttp()
