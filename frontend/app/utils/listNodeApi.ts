// Helper function to handle authentication errors
function handleAuthError(response: Response) {
  if (response.status === 401) {
    console.error('Authentication failed - redirecting to login');
    localStorage.removeItem('token');
    window.location.href = '/login';
    throw new Error('Hitelesítés sikertelen - átirányítás a bejelentkezésre');
  }
}

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
    handleAuthError(response);
    throw new Error('Nem sikerült törölni');
  }
}

export async function updateListNode(nodeId: number, name: string, position?: number): Promise<void> {
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('Nincs token');
  }

  const body: any = { name: name };
  if (position !== undefined) {
    body.position = position;
  }

  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/listnodes/${nodeId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    handleAuthError(response);
    throw new Error('Nem sikerült frissíteni');
  }
}

export async function moveListNode(nodeId: number, newParentId: number, newPosition?: number): Promise<void> {
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('Nincs token');
  }

  const body: any = { parentId: newParentId };
  if (newPosition !== undefined) {
    body.position = newPosition;
  }

  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/listnodes/${nodeId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    handleAuthError(response);
    throw new Error('Nem sikerült átmozgatni');
  }
}

export async function createListNode(parentId: number, name: string, type: string = 'item'): Promise<any> {
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('Nincs token');
  }

  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/listnodes`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: name,
      type: type,
      parentId: parentId,
    }),
  });

  if (!response.ok) {
    throw new Error('Nem sikerült létrehozni');
  }

  return response.json();
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
    // If 404, it means the sublist has no children yet - return empty array
    if (response.status === 404) {
      console.log(`Sublist ${parentId} has no children yet, returning empty array`);
      return [];
    }

    // Handle authentication errors
    handleAuthError(response);

    console.error(`Failed to fetch children for ${parentId}:`, response.status, response.statusText);
    throw new Error(`Nem sikerült betölteni (${response.status})`);
  }

  return response.json();
}
