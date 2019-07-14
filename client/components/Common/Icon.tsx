import React from 'react'
import MDIIcon from '@mdi/react'
import * as MDIJs from '@mdi/js'

// TODO: support size and so far
interface Props {
  name: string
  spin: boolean
  className?: string
}

export default class Icon extends React.Component<Props> {
  static defaultProps = { spin: false }

  toPathName(name: string): string {
    return (
      'mdi' +
      name.charAt(0).toUpperCase() +
      name.slice(1).replace(/([-_][a-z])/gi, $1 => {
        return $1
          .toUpperCase()
          .replace('-', '')
          .replace('_', '')
      })
    )
  }

  render() {
    const { name, spin, ...props } = this.props

    if (!name) {
      return ''
    }

    let path = this.toPathName(name)
    console.log(path, spin)

    return <MDIIcon className="mdi-svg" path={MDIJs[path]} spin={spin} {...props} />
  }
}
