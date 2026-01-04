export async function toggleListNode(nodeId: number, currentState: boolean): Promise<void> {
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('Nincs token');
  }

  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/listnodes/${nodeId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      isChecked: !currentState,
    }),
  });

  if (!response.ok) {
    throw new Error('Nem sikerült frissíteni');
  }
}

export async function deleteListNode(nodeId: number): Promise<void> {
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('Nincs token');
  }

  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/listnodes/${nodeId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Nem sikerült törölni');
  }
}

export async function fetchChildren(parentId: number) {
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('Nincs token');
  }

  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/listnodes/${parentId}/children`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Nem sikerült betölteni');
  }

  return response.json();
}
