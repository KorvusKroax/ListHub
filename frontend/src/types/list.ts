export interface ListEntity {
  id: number;
  name: string;
  itemCount?: number;
  completedCount?: number;
}

export interface Item {
  id: number;
  name: string;
  isChecked: boolean;
}

export interface ListDetail extends ListEntity {
  items: Item[];
}
