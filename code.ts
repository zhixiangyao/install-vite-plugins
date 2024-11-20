export const code = `
import { type Plugin } from 'vite'
import * as path from 'path'
import { existsSync, writeFileSync, statSync } from 'fs'

const FILE_TYPE_LIST: \`.$\{string\}\`[] = ['.ts', '.d.ts', '.tsx', '.js', '.jsx', '.vue']

/** 递归查找 [指定的文件夹 or 文件] */
const findDirectory = (currentDir: string, alias: string) => {
  const fullPath = path.join(currentDir, alias)

  // 如果是目录
  if (existsSync(fullPath)) {
    return fullPath
  }

  // 如果是文件
  for (const fileType of FILE_TYPE_LIST) {
    const completedPath = fullPath + fileType
    if (existsSync(completedPath)) return fullPath
  }

  // 返回上级
  const parentDir = path.dirname(currentDir)
  if (parentDir === currentDir) {
    return null
  }
  return findDirectory(parentDir, alias)
}

type CreateTsConfigFileParams = { tsconfigPath: string; scoped: string; alias: string }

/** 创建 tsconfig 文件 */
const createTsConfigFile = ({ tsconfigPath, scoped, alias }: CreateTsConfigFileParams) => {
  const length = tsconfigPath.split(scoped)[1].split('/').length - 1

  const data = {
    extends:
      Array.from({ length })
        .map(() => '..')
        .join('/') + '/tsconfig.json',
    compilerOptions: {
      baseUrl: '.',
      paths: {
        [\`$$\{alias\}/*\`]: [\`./$\{alias\}/*\`],
        '@/*': [
          Array.from({ length: length - 1 })
            .map(() => '..')
            .join('/') + '/*',
        ],
      },
    },
  }

  const jsonData = JSON.stringify(data, null, 2) // null 和 2 用于格式化输出

  writeFileSync(path.resolve(tsconfigPath), jsonData)
}

/** 在给定路径及其父目录中查找 [指定的文件夹 or 文件] */
const findFolderUpwards = (startPath: string, alias: string): null | string => {
  let currentPath = startPath

  // 统一使用 posix 路径，确保在 Windows 上也能使用正斜杠
  currentPath = path.posix.normalize(currentPath)

  // 递归向上查找，直到到达根目录
  while (currentPath !== path.parse(currentPath).root) {
    const folderPath = path.join(currentPath, alias)

    // 检查 [指定的文件夹] 下,是否有对应的 {alias} 这个 [目录]
    if (existsSync(folderPath) && statSync(folderPath).isDirectory()) {
      return currentPath // 找到 [指定的文件夹]，返回路径
    }

    // 检查 [指定的文件夹] 下,是否有对应的 {alias} 这个 [文件]
    for (const fileType of FILE_TYPE_LIST) {
      const completedPath = folderPath + fileType

      if (existsSync(completedPath)) {
        return currentPath // 找到 [指定的文件]，返回路径
      }
    }

    // 向上查找父目录
    currentPath = path.dirname(currentPath)
  }

  return null
}

/** 转换成 unix 地址符号 */
const transferUnixPathSymbol = (path: string) => path.replace(/\\\\/g, '/')

export default function pathAliasPlugin({ scoped = '/src' } = {}): Plugin {
  return {
    name: 'vite-plugin-path-alias',

    /** 解析 $ 开头的路径, 并且自动创建 tsconfig.json */
    resolveId(source: string, importer) {
      if (source.startsWith('$') && importer.includes(scoped)) {
        const [alias, ...reset] = source.replace('$', '').split('/')
        const importerDir = path.dirname(importer)
        const prefixPath = findDirectory(importerDir, alias)

        if (prefixPath) {
          const prefixPathUnix = transferUnixPathSymbol(prefixPath)
          const fullPath = reset.length === 0 ? prefixPathUnix : \`$\{prefixPathUnix\}/$\{reset.join('/')\}\`
          let completedPath: string | null = null

          try {
            for (const fileType of FILE_TYPE_LIST) {
              if (existsSync(fullPath + fileType)) {
                completedPath = fullPath + fileType
                return completedPath
              }
            }
          } finally {
            if (!completedPath) return

            const correctPathUnix = findFolderUpwards(importerDir, alias)?.replace(/\\\\/g, '/')
            const tsconfigPath = \`$\{correctPathUnix\}/tsconfig.json\`

            if (existsSync(tsconfigPath) === false) {
              createTsConfigFile({ tsconfigPath, scoped, alias })
              console.log(tsconfigPath, \`创建成功\`)
            } else {
              console.log(tsconfigPath, \`已存在\`)
            }
          }
        }

        return null
      }

      return null
    },
  }
}
`