import { RegionSelector } from './components/RegionSelector'
import { PreviewWindow } from './components/PreviewWindow'

export function App(): React.ReactElement {
  const hash = window.location.hash

  if (hash === '#preview') {
    return <PreviewWindow />
  }

  return <RegionSelector />
}
