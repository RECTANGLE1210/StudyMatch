import { configurationError } from '../lib/config/env'
import { Providers } from './providers'
import { AppRouter } from './router'
export default function App() { return configurationError ? <p role="alert" className="card p-6 m-6">{configurationError}</p> : <Providers><AppRouter /></Providers> }
