<?php

namespace App\Controller\Api;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\JsonResponse;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\SecurityBundle\Security;
use App\Entity\Item;
use App\Entity\ListEntity;
use App\Entity\User;

#[Route('/api', name: 'api_')]
class ListApiController extends AbstractController
{
    #[Route('/lists', name: 'api_lists', methods: ['GET'])]
    public function lists(EntityManagerInterface $em): Response
    {
        $user = $this->getUser();
        if (!$user) {
            return $this->json(['error' => 'Unauthorized'], Response::HTTP_UNAUTHORIZED);
        }

        $lists = $em->getRepository(ListEntity::class)
            ->createQueryBuilder('l')
            ->join('l.users', 'u')
            ->andWhere('u = :user')
            ->andWhere('l.parent IS NULL')
            ->orderBy('l.position', 'ASC')
            ->addOrderBy('l.id', 'ASC')
            ->setParameter('user', $user)
            ->getQuery()
            ->getResult();

        $data = [];
        foreach ($lists as $list) {
            $data[] = [
                'id' => $list->getId(),
                'name' => $list->getName(),
                'parentId' => $list->getParent()?->getId(),
                'itemCount' => $list->getItems()->count(),
                'completedCount' => $list->getItems()->filter(fn (Item $i) => $i->isChecked())->count(),
                'childCount' => $list->getChildren()->count(),
            ];
        }

        return $this->json($data);
    }

    #[Route('/lists/{id}', name: 'api_list_show', methods: ['GET'], requirements: ['id' => '\d+'])]
    public function listShow(int $id, EntityManagerInterface $em): Response
    {
        $user = $this->getUser();
        if (!$user) {
            return $this->json(['error' => 'Unauthorized'], Response::HTTP_UNAUTHORIZED);
        }

        $list = $em->getRepository(ListEntity::class)->find($id);
        if (!$list) {
            return $this->json(['error' => 'Not found'], Response::HTTP_NOT_FOUND);
        }

        if (!$this->userHasAccess($user, $list)) {
            return $this->json(['error' => 'Forbidden'], Response::HTTP_FORBIDDEN);
        }

        $itemsData = [];
        foreach ($list->getItems() as $item) {
            $itemsData[] = [
                'id' => $item->getId(),
                'name' => $item->getName(),
                'isChecked' => $item->isChecked(),
            ];
        }

        $childrenData = [];
        foreach ($list->getChildren() as $child) {
            $childrenData[] = [
                'id' => $child->getId(),
                'name' => $child->getName(),
                'itemCount' => $child->getItems()->count(),
                'completedCount' => $child->getItems()->filter(fn (Item $i) => $i->isChecked())->count(),
            ];
        }

        $data = [
            'id' => $list->getId(),
            'name' => $list->getName(),
            'parentId' => $list->getParent()?->getId(),
            'items' => $itemsData,
            'children' => $childrenData,
        ];

        return $this->json($data);
    }

    #[Route('/lists', name: 'api_list_create', methods: ['POST'])]
    public function createList(
        Request $request,
        EntityManagerInterface $em
    ): JsonResponse {
        /** @var User|null $user */
        $user = $this->getUser();
        if (!$user) {
            return $this->json(['error' => 'Unauthorized'], 401);
        }

        $data = json_decode($request->getContent(), true);
        if (!is_array($data) || !array_key_exists('name', $data)) {
            return $this->json(['error' => 'Name is required'], 400);
        }

        $name = trim((string) $data['name']);
        if ($name === '') {
            return $this->json(['error' => 'Name cannot be empty'], 400);
        }

        $list = new ListEntity();
        $list->setName($name);
        $list->addUser($user);

        // Ha van parentId, hozzárendeljük
        if (!empty($data['parentId'])) {
            $parent = $em->getRepository(ListEntity::class)->find($data['parentId']);
            if ($parent && $this->userHasAccess($user, $parent)) {
                $list->setParent($parent);
                $list->setPosition($parent->getChildren()->count());
            }
        }

        // Ha nincs parent, a gyökérben a felhasználó következő pozícióját kapja
        if ($list->getParent() === null) {
            $qb = $em->getRepository(ListEntity::class)->createQueryBuilder('l');
            $count = (int) $qb
                ->select('COUNT(l.id)')
                ->join('l.users', 'u')
                ->andWhere('u = :user')
                ->andWhere('l.parent IS NULL')
                ->setParameter('user', $user)
                ->getQuery()
                ->getSingleScalarResult();
            $list->setPosition($count);
        }

        $em->persist($list);
        $em->flush();

        return $this->json([
            'id' => $list->getId(),
            'name' => $list->getName(),
            'parentId' => $list->getParent()?->getId(),
        ], 201);
    }

    #[Route('/lists/{id}', name: 'api_list_update', methods: ['PUT'], requirements: ['id' => '\d+'])]
    public function updateList(
        int $id,
        Request $request,
        EntityManagerInterface $em
    ): JsonResponse {
        /** @var User|null $user */
        $user = $this->getUser();
        if (!$user) {
            return $this->json(['error' => 'Unauthorized'], 401);
        }

        /** @var ListEntity|null $list */
        $list = $em->getRepository(ListEntity::class)->find($id);
        if (!$list) {
            return $this->json(['error' => 'List not found'], 404);
        }

        if (!$this->userHasAccess($user, $list)) {
            return $this->json(['error' => 'Forbidden'], 403);
        }

        $data = json_decode($request->getContent(), true);
        if (!is_array($data) || !array_key_exists('name', $data)) {
            return $this->json(['error' => 'Name is required'], 400);
        }

        $name = trim((string) $data['name']);
        if ($name === '') {
            return $this->json(['error' => 'Name cannot be empty'], 400);
        }

        $list->setName($name);
        $em->flush();

        return $this->json([
            'id' => $list->getId(),
            'name' => $list->getName(),
        ]);
    }

    #[Route('/lists/{id}', name: 'api_list_delete', methods: ['DELETE'], requirements: ['id' => '\d+'])]
    public function deleteList(
        int $id,
        EntityManagerInterface $em
    ): JsonResponse {
        /** @var User|null $user */
        $user = $this->getUser();
        if (!$user) {
            return $this->json(['error' => 'Unauthorized'], 401);
        }

        /** @var ListEntity|null $list */
        $list = $em->getRepository(ListEntity::class)->find($id);
        if (!$list) {
            return $this->json(['error' => 'List not found'], 404);
        }

        if (!$this->userHasAccess($user, $list)) {
            return $this->json(['error' => 'Forbidden'], 403);
        }

        $em->remove($list);
        $em->flush();

        return $this->json(null, 204);
    }

    #[Route('/lists/{id}/users', name: 'api_list_users', methods: ['GET'])]
    public function listUsers(int $id, EntityManagerInterface $em): JsonResponse {
        $user = $this->getUser();
        if (!$user) return $this->json(['error' => 'Unauthorized'], 401);

        $list = $em->getRepository(ListEntity::class)->find($id);
        if (!$list) return $this->json(['error' => 'List not found'], 404);

        if (!$this->userHasAccess($user, $list)) return $this->json(['error' => 'Forbidden'], 403);

        $users = [];
        foreach ($list->getUsers() as $u) {
            $users[] = ['id' => $u->getId(), 'username' => $u->getUsername(), 'email' => $u->getEmail()];
        }
        return $this->json($users);
    }

    #[Route('/lists/{id}/share', name: 'api_list_share', methods: ['POST'])]
    public function shareList(int $id, Request $request, EntityManagerInterface $em): JsonResponse {
        $actor = $this->getUser();
        if (!$actor) return $this->json(['error' => 'Unauthorized'], 401);

        $list = $em->getRepository(ListEntity::class)->find($id);
        if (!$list) return $this->json(['error' => 'List not found'], 404);

        if (!$this->userHasAccess($actor, $list)) return $this->json(['error' => 'Forbidden'], 403);

        $data = json_decode($request->getContent(), true) ?? [];
        $username = trim((string)($data['username'] ?? ''));
        if ($username === '') return $this->json(['error' => 'Username is required'], 400);

        $target = $em->getRepository(User::class)->findOneBy(['username' => $username]);
        if (!$target) return $this->json(['error' => 'User not found'], 404);

        if ($list->getUsers()->contains($target)) {
            return $this->json(['message' => 'Already shared'], 200);
        }

        $list->addUser($target);
        $em->flush();

        return $this->json(['message' => 'Shared', 'user' => ['id' => $target->getId(), 'username' => $target->getUsername()]], 201);
    }

    #[Route('/lists/{id}/share/{userId}', name: 'api_list_unshare', methods: ['DELETE'])]
    public function unshareList(int $id, int $userId, EntityManagerInterface $em): JsonResponse {
        $actor = $this->getUser();
        if (!$actor) return $this->json(['error' => 'Unauthorized'], 401);

        $list = $em->getRepository(ListEntity::class)->find($id);
        if (!$list) return $this->json(['error' => 'List not found'], 404);

        if (!$this->userHasAccess($actor, $list)) return $this->json(['error' => 'Forbidden'], 403);

        $target = $em->getRepository(User::class)->find($userId);
        if (!$target) return $this->json(['error' => 'User not found'], 404);

        if (!$list->getUsers()->contains($target)) {
            return $this->json(['message' => 'Not shared'], 200);
        }

        $list->removeUser($target);
        $em->flush();

        return $this->json(null, 204);
    }

    #[Route('/lists/{id}/items', name: 'api_list_add_item', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function addItem(int $id, Request $request, EntityManagerInterface $em): Response
    {
        $user = $this->getUser();
        if (!$user) {
            return $this->json(['error' => 'Unauthorized'], Response::HTTP_UNAUTHORIZED);
        }

        $list = $em->getRepository(ListEntity::class)->find($id);
        if (!$list) {
            return $this->json(['error' => 'Not found'], Response::HTTP_NOT_FOUND);
        }

        if (!$this->userHasAccess($user, $list)) {
            return $this->json(['error' => 'Forbidden'], Response::HTTP_FORBIDDEN);
        }

        $data = json_decode($request->getContent(), true) ?? [];
        $name = trim((string)($data['name'] ?? ''));

        if ($name === '') {
            return $this->json(['error' => 'Name is required'], Response::HTTP_BAD_REQUEST);
        }

        $item = new Item();
        $item->setName($name);
        $item->setIsChecked(false);
        $item->setPosition($list->getItems()->count());
        $item->setList($list);

        $em->persist($item);
        $em->flush();

        return $this->json([
            'id' => $item->getId(),
            'name' => $item->getName(),
            'isChecked' => $item->isChecked(),
        ], Response::HTTP_CREATED);
    }

    #[Route('/items/{id}', name: 'api_item_update', methods: ['PUT'])]
    public function updateItem(
        int $id,
        Request $request,
        EntityManagerInterface $em,
        Security $security
    ): JsonResponse {
        /** @var User|null $user */
        $user = $security->getUser();
        if (!$user) {
            return $this->json(['error' => 'Unauthorized'], 401);
        }

        /** @var Item|null $item */
        $item = $em->getRepository(Item::class)->find($id);
        if (!$item) {
            return $this->json(['error' => 'Item not found'], 404);
        }

        $list = $item->getList();
        if (!$list || !$this->userHasAccess($user, $list)) {
            return $this->json(['error' => 'Forbidden'], 403);
        }

        $data = json_decode($request->getContent(), true);
        if (!is_array($data)) {
            return $this->json(['error' => 'Invalid JSON'], 400);
        }

        if (array_key_exists('name', $data)) {
            $name = trim((string) $data['name']);
            if ($name === '') {
                return $this->json(['error' => 'Name cannot be empty'], 400);
            }
            $item->setName($name);
        }

        if (array_key_exists('isChecked', $data)) {
            $item->setIsChecked((bool) $data['isChecked']);
        }

        $em->flush();

        return $this->json([
            'id' => $item->getId(),
            'name' => $item->getName(),
            'isChecked' => $item->isChecked(),
        ]);
    }

    #[Route('/items/{id}', name: 'api_item_delete', methods: ['DELETE'], requirements: ['id' => '\d+'])]
    public function deleteItem(int $id, EntityManagerInterface $em): Response
    {
        $user = $this->getUser();
        if (!$user) {
            return $this->json(['error' => 'Unauthorized'], Response::HTTP_UNAUTHORIZED);
        }

        $item = $em->getRepository(Item::class)->find($id);
        if (!$item) {
            return $this->json(['error' => 'Not found'], Response::HTTP_NOT_FOUND);
        }

        $list = $item->getList();
        if (!$list || !$this->userHasAccess($user, $list)) {
            return $this->json(['error' => 'Forbidden'], Response::HTTP_FORBIDDEN);
        }

        $em->remove($item);
        $em->flush();

        return $this->json(null, Response::HTTP_NO_CONTENT);
    }

    #[Route('/items/{id}/move', name: 'api_item_move', methods: ['PUT'], requirements: ['id' => '\\d+'])]
    public function moveItem(
        int $id,
        Request $request,
        EntityManagerInterface $em,
        Security $security
    ): JsonResponse {
        /** @var User|null $user */
        $user = $security->getUser();
        if (!$user) {
            return $this->json(['error' => 'Unauthorized'], 401);
        }

        /** @var Item|null $item */
        $item = $em->getRepository(Item::class)->find($id);
        if (!$item) {
            return $this->json(['error' => 'Item not found'], 404);
        }

        $currentList = $item->getList();
        if (!$currentList || !$this->userHasAccess($user, $currentList)) {
            return $this->json(['error' => 'Forbidden'], 403);
        }

        $data = json_decode($request->getContent(), true) ?? [];
        $targetListId = $data['listId'] ?? null;
        if (!$targetListId) {
            return $this->json(['error' => 'listId is required'], 400);
        }

        /** @var ListEntity|null $targetList */
        $targetList = $em->getRepository(ListEntity::class)->find($targetListId);
        if (!$targetList) {
            return $this->json(['error' => 'Target list not found'], 404);
        }

        if (!$this->userHasAccess($user, $targetList)) {
            return $this->json(['error' => 'Forbidden'], 403);
        }

        if ($targetList->getId() === $currentList->getId()) {
            return $this->json([
                'id' => $item->getId(),
                'name' => $item->getName(),
                'isChecked' => $item->isChecked(),
                'listId' => $currentList->getId(),
            ]);
        }

        $item->setList($targetList);
        $item->setPosition($targetList->getItems()->count());
        $em->flush();

        return $this->json([
            'id' => $item->getId(),
            'name' => $item->getName(),
            'isChecked' => $item->isChecked(),
            'listId' => $targetList->getId(),
        ]);
    }

    #[Route('/lists/{id}/items/reorder', name: 'api_list_items_reorder', methods: ['PUT'], requirements: ['id' => '\d+'])]
    public function reorderItems(
        int $id,
        Request $request,
        EntityManagerInterface $em
    ): JsonResponse {
        /** @var User|null $user */
        $user = $this->getUser();
        if (!$user) {
            return $this->json(['error' => 'Unauthorized'], 401);
        }

        /** @var ListEntity|null $list */
        $list = $em->getRepository(ListEntity::class)->find($id);
        if (!$list) {
            return $this->json(['error' => 'List not found'], 404);
        }

        if (!$this->userHasAccess($user, $list)) {
            return $this->json(['error' => 'Forbidden'], 403);
        }

        $data = json_decode($request->getContent(), true) ?? [];
        $orderedIds = $data['itemIds'] ?? $data['ids'] ?? null;
        if (!is_array($orderedIds) || count($orderedIds) === 0) {
            return $this->json(['error' => 'itemIds array is required'], 400);
        }

        $orderedIds = array_values(array_map('intval', $orderedIds));
        if (count($orderedIds) !== count(array_unique($orderedIds))) {
            return $this->json(['error' => 'Duplicate ids are not allowed'], 400);
        }

        $totalInList = $list->getItems()->count();
        if ($totalInList !== count($orderedIds)) {
            return $this->json(['error' => 'All items must be included'], 400);
        }

        $items = $em->getRepository(Item::class)
            ->createQueryBuilder('i')
            ->where('i.list = :list')
            ->andWhere('i.id IN (:ids)')
            ->setParameter('list', $list)
            ->setParameter('ids', $orderedIds)
            ->getQuery()
            ->getResult();

        if (count($items) !== count($orderedIds)) {
            return $this->json(['error' => 'Invalid itemIds for this list'], 400);
        }

        $itemsById = [];
        foreach ($items as $item) {
            $itemsById[$item->getId()] = $item;
        }

        foreach ($orderedIds as $position => $itemId) {
            $itemsById[$itemId]->setPosition($position);
        }

        $em->flush();

        return $this->json(['message' => 'Reordered']);
    }

    #[Route('/lists/{id}/move', name: 'api_list_move', methods: ['PUT'], requirements: ['id' => '\\d+'])]
    public function moveList(
        int $id,
        Request $request,
        EntityManagerInterface $em,
        Security $security
    ): JsonResponse {
        /** @var User|null $user */
        $user = $security->getUser();
        if (!$user) {
            return $this->json(['error' => 'Unauthorized'], 401);
        }

        /** @var ListEntity|null $list */
        $list = $em->getRepository(ListEntity::class)->find($id);
        if (!$list) {
            return $this->json(['error' => 'List not found'], 404);
        }

        if (!$this->userHasAccess($user, $list)) {
            return $this->json(['error' => 'Forbidden'], 403);
        }

        $data = json_decode($request->getContent(), true) ?? [];
        $parentId = $data['parentId'] ?? null;

        $newParent = null;
        if ($parentId !== null) {
            /** @var ListEntity|null $candidate */
            $candidate = $em->getRepository(ListEntity::class)->find($parentId);
            if (!$candidate) {
                return $this->json(['error' => 'Target parent not found'], 404);
            }
            if (!$this->userHasAccess($user, $candidate)) {
                return $this->json(['error' => 'Forbidden'], 403);
            }
            if ($candidate->getId() === $list->getId() || $this->isDescendantOf($candidate, $list)) {
                return $this->json(['error' => 'Cannot move list under itself or its descendant'], 400);
            }
            $newParent = $candidate;
        }

        $list->setParent($newParent);
        if ($newParent) {
            $list->setPosition($newParent->getChildren()->count());
        } else {
            $qb = $em->getRepository(ListEntity::class)->createQueryBuilder('l');
            $count = (int) $qb
                ->select('COUNT(l.id)')
                ->join('l.users', 'u')
                ->andWhere('u = :user')
                ->andWhere('l.parent IS NULL')
                ->setParameter('user', $user)
                ->getQuery()
                ->getSingleScalarResult();
            $list->setPosition($count);
        }
        $em->flush();

        return $this->json([
            'id' => $list->getId(),
            'name' => $list->getName(),
            'parentId' => $list->getParent() ? $list->getParent()->getId() : null,
        ]);
    }

    #[Route('/lists/{id}/children/reorder', name: 'api_list_children_reorder', methods: ['PUT'], requirements: ['id' => '\d+'])]
    public function reorderChildren(
        int $id,
        Request $request,
        EntityManagerInterface $em
    ): JsonResponse {
        /** @var User|null $user */
        $user = $this->getUser();
        if (!$user) {
            return $this->json(['error' => 'Unauthorized'], 401);
        }

        /** @var ListEntity|null $parent */
        $parent = $em->getRepository(ListEntity::class)->find($id);
        if (!$parent) {
            return $this->json(['error' => 'List not found'], 404);
        }

        if (!$this->userHasAccess($user, $parent)) {
            return $this->json(['error' => 'Forbidden'], 403);
        }

        $data = json_decode($request->getContent(), true) ?? [];
        $orderedIds = $data['listIds'] ?? $data['ids'] ?? null;
        if (!is_array($orderedIds) || count($orderedIds) === 0) {
            return $this->json(['error' => 'listIds array is required'], 400);
        }

        $orderedIds = array_values(array_map('intval', $orderedIds));
        if (count($orderedIds) !== count(array_unique($orderedIds))) {
            return $this->json(['error' => 'Duplicate ids are not allowed'], 400);
        }

        $totalChildren = $parent->getChildren()->count();
        if ($totalChildren !== count($orderedIds)) {
            return $this->json(['error' => 'All child lists must be included'], 400);
        }

        $children = $em->getRepository(ListEntity::class)
            ->createQueryBuilder('l')
            ->where('l.parent = :parent')
            ->andWhere('l.id IN (:ids)')
            ->setParameter('parent', $parent)
            ->setParameter('ids', $orderedIds)
            ->getQuery()
            ->getResult();

        if (count($children) !== count($orderedIds)) {
            return $this->json(['error' => 'Invalid listIds for this parent'], 400);
        }

        $childrenById = [];
        foreach ($children as $child) {
            $childrenById[$child->getId()] = $child;
        }

        foreach ($orderedIds as $position => $listId) {
            $childrenById[$listId]->setPosition($position);
        }

        $em->flush();

        return $this->json(['message' => 'Reordered']);
    }

    private function isDescendantOf(?ListEntity $candidateParent, ListEntity $child): bool
    {
        $cursor = $candidateParent;
        while ($cursor !== null) {
            if ($cursor->getId() === $child->getId()) {
                return true;
            }
            $cursor = $cursor->getParent();
        }
        return false;
    }

    private function userHasAccess(User $user, ListEntity $list): bool
    {
        return $list->getUsers()->contains($user);
    }
}
