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
            ->setParameter('user', $user)
            ->getQuery()
            ->getResult();

        $data = [];
        foreach ($lists as $list) {
            $data[] = [
                'id' => $list->getId(),
                'name' => $list->getName(),
                'itemCount' => $list->getItems()->count(),
                'completedCount' => $list->getItems()->filter(fn (Item $i) => $i->isChecked())->count(),
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

        $data = [
            'id' => $list->getId(),
            'name' => $list->getName(),
            'items' => $itemsData,
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

        $em->persist($list);
        $em->flush();

        return $this->json([
            'id' => $list->getId(),
            'name' => $list->getName(),
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

    private function userHasAccess(User $user, ListEntity $list): bool
    {
        return $list->getUsers()->contains($user);
    }
}
