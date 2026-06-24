import { RegionSelector } from './components/RegionSelector'
import { PreviewWindow } from './components/PreviewWindow'
import { Onboarding } from './components/Onboarding'

export function App(): React.ReactElement {
  const hash = window.location.hash

  if (hash === '#onboarding') {
    return <Onboarding />
  }

  if (hash === '#preview') {
    return <PreviewWindow />
  }

  return <RegionSelector />
}
