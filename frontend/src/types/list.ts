export interface ListGroup {
  id: number;
  name: string;
  listCount?: number;
  lists?: ListEntity[];
}

export interface ListEntity {
  id: number;
  name: string;
  listGroupId?: number;
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
