import dotenv from 'dotenv'
import path from 'path'

const envPath = path.resolve(process.cwd(), '../../.env')
dotenv.config({ path: envPath })
