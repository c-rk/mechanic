import { useLocalSearchParams } from 'expo-router';
import { Text } from 'react-native';

import { Shell } from '../../components/Shell';
import { AssistantTab } from '../../components/tabs/IntelAssistant';
import { T } from '../../components/ui';
import { useStore } from '../../lib/store';

export default function AssistantScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const v = useStore((s) => s.vehicles.find((x) => x.id === id));
  return (
    <Shell title="Mechanic" eyebrow={v ? v.nickname || `${v.make} ${v.model}` : 'Bay One'} back>
      {v ? <AssistantTab v={v} /> : <Text style={T.dim}>Vehicle not found.</Text>}
    </Shell>
  );
}
