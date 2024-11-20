import * as path from 'path'
import * as fs from 'fs'

import { code } from './code'

const ensureFileExists = (filePath: string, data = '') => {
  const absolutePath = path.resolve(filePath) // 获取文件的绝对路径
  const dirPath = path.dirname(absolutePath) // 获取文件所在的目录

  // 确保目录存在
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }

  // 确保文件存在
  if (!fs.existsSync(absolutePath)) {
    fs.writeFileSync(absolutePath, data, 'utf8') // 创建文件
  }
}

/** 转换成 unix 地址符号 */
const transferUnixPathSymbol = (path: string) => path.replace(/\\/g, '/')

type TGeneratorTsconfigFileParams = {
  path: string
  scoped: string
}

const generatorTsconfigFile = async (params: TGeneratorTsconfigFileParams) => {
  const { path, scoped } = params
  const tsconfigFilePath = path + '/tsconfig.json'

  if (fs.existsSync(tsconfigFilePath)) {
    console.log(`当前目录的 tsconfig.json 已存在!`)
    return false
  }

  const length = tsconfigFilePath.split(scoped)[1].split('/').length - 1

  const data = {
    extends:
      Array.from({ length })
        .map(() => '..')
        .join('/') + '/tsconfig.json',
    compilerOptions: {
      baseUrl: '.',
      paths: {
        [`$utils/*`]: [`./utils/*`],
        '@/*': [
          Array.from({ length: length - 1 })
            .map(() => '..')
            .join('/') + '/*',
        ],
      },
    },
  }

  const jsonData = JSON.stringify(data, null, 2) // null 和 2 用于格式化输出

  ensureFileExists(tsconfigFilePath, jsonData)
  console.log('当前目录的 tsconfig.json 创建成功!')
  return true
}

type TGeneratorFileParams = {
  pluginFilePath: string
  data: string
}

const generatorFile = async (params: TGeneratorFileParams) => {
  const { pluginFilePath, data } = params

  if (fs.existsSync(pluginFilePath)) {
    console.log(`plugin 已存在!`)
    return false
  }

  ensureFileExists(pluginFilePath, data.trimStart())
  console.log('plugin 创建成功!')
  return true
}

type TInjectPluginToViteConfig = {
  viteConfigFilePath: string
  importCode: string
  callCode: string
}

const injectPluginToViteConfig = (params: TInjectPluginToViteConfig) => {
  const { viteConfigFilePath, importCode, callCode } = params

  const fileContent = fs.readFileSync(viteConfigFilePath, 'utf-8')

  if (fileContent.includes('vite-plugin-path-alias')) {
    console.log('已添加 vite-plugin-path-alias, 不需要注入!')
    return false
  }

  const lines = `${importCode}\n${fileContent}`.split('\n')
  const index = lines.findIndex(line => line.includes('plugins:'))

  index !== -1 && lines.splice(index + 1, 0, `    ${callCode}`)

  fs.writeFileSync(viteConfigFilePath, lines.join('\n'), 'utf8') // 创建文件
  console.log('注入插件成功!')
}

/** 生成 tsconfig.json 文件 */
await generatorTsconfigFile({
  path: transferUnixPathSymbol(path.resolve('../finance-admin/src/views/pay')),
  scoped: '/src',
})

/** 生成 vite-plugin-path-alias 文件 */
const res = await generatorFile({
  pluginFilePath: '../finance-admin/vite-plugins/vite-plugin-path-alias.ts',
  data: code,
})

/** 注入 vite-plugin-path-alias 插件到 vite.config.ts */
res &&
  injectPluginToViteConfig({
    viteConfigFilePath: '../finance-admin/vite.config.ts',
    importCode: "import pathAliasPlugin from './vite-plugins/vite-plugin-path-alias'",
    callCode: 'pathAliasPlugin(),',
  })
