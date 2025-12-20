export interface ListEntity {
  id: number;
  name: string;
}

export interface Item {
  id: number;
  name: string;
  isChecked: boolean;
}

export interface ListDetail extends ListEntity {
  items: Item[];
}
