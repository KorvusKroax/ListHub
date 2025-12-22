export interface ListEntity {
  id: number;
  name: string;
  parentId?: number;
  itemCount?: number;
  completedCount?: number;
  childCount?: number;
}

export interface Item {
  id: number;
  name: string;
  isChecked: boolean;
}

export interface ListDetail extends ListEntity {
  items: Item[];
  children?: ListEntity[];
}
