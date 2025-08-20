import { gql, useQuery } from "@apollo/client";
import { Button, Text, View } from "react-native";

const PING = gql`query Ping { __typename }`;

export default function Home() {
  const { data, loading, error, refetch } = useQuery(PING);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}>
      <Text style={{ fontSize: 18, fontWeight: "600" }}>SixByFive TCG Mobile</Text>
      {loading && <Text>Loading…</Text>}
      {error && <Text style={{ color: "red" }}>{String(error.message)}</Text>}
      {data && <Text>GraphQL OK: {data.__typename}</Text>}
      <Button title="Refetch" onPress={() => refetch()} />
    </View>
  );
}
