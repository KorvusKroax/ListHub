<?php

namespace App\Controller\Api;

use App\Entity\ListGroup;
use App\Entity\ListEntity;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;

#[Route('/api/list-groups')]
class ListGroupApiController extends AbstractController
{
    #[Route('', name: 'api_list_groups', methods: ['GET'])]
    public function index(EntityManagerInterface $em): JsonResponse
    {
        $user = $this->getUser();
        if (!$user instanceof User) {
            return $this->json(['error' => 'Unauthorized'], 401);
        }

        $groups = $em->getRepository(ListGroup::class)
            ->createQueryBuilder('g')
            ->leftJoin('g.users', 'u')
            ->andWhere('u = :user')
            ->setParameter('user', $user)
            ->getQuery()
            ->getResult();

        $data = array_map(function (ListGroup $group) {
            return [
                'id' => $group->getId(),
                'name' => $group->getName(),
                'listCount' => $group->getLists()->count(),
            ];
        }, $groups);

        return $this->json($data);
    }

    #[Route('/{id}', name: 'api_list_group_show', methods: ['GET'])]
    public function show(int $id, EntityManagerInterface $em): JsonResponse
    {
        $user = $this->getUser();
        if (!$user instanceof User) {
            return $this->json(['error' => 'Unauthorized'], 401);
        }

        $group = $em->getRepository(ListGroup::class)->find($id);
        if (!$group) {
            return $this->json(['error' => 'Not found'], 404);
        }

        if (!$group->getUsers()->contains($user)) {
            return $this->json(['error' => 'Forbidden'], 403);
        }

        $lists = array_map(function (ListEntity $list) {
            return [
                'id' => $list->getId(),
                'name' => $list->getName(),
                'itemCount' => $list->getItems()->count(),
                'completedCount' => $list->getItems()->filter(fn (\App\Entity\Item $i) => $i->isChecked())->count(),
            ];
        }, $group->getLists()->toArray());

        return $this->json([
            'id' => $group->getId(),
            'name' => $group->getName(),
            'lists' => $lists,
        ]);
    }

    #[Route('', name: 'api_list_group_create', methods: ['POST'])]
    public function create(Request $request, EntityManagerInterface $em): JsonResponse
    {
        $user = $this->getUser();
        if (!$user instanceof User) {
            return $this->json(['error' => 'Unauthorized'], 401);
        }

        $data = json_decode($request->getContent(), true);
        $name = trim($data['name'] ?? '');

        if (!$name) {
            return $this->json(['error' => 'Name required'], 400);
        }

        $group = new ListGroup();
        $group->setName($name);
        $group->addUser($user);

        $em->persist($group);
        $em->flush();

        return $this->json([
            'id' => $group->getId(),
            'name' => $group->getName(),
            'listCount' => 0,
        ], 201);
    }

    #[Route('/{id}', name: 'api_list_group_update', methods: ['PUT'])]
    public function update(int $id, Request $request, EntityManagerInterface $em): JsonResponse
    {
        $user = $this->getUser();
        if (!$user instanceof User) {
            return $this->json(['error' => 'Unauthorized'], 401);
        }

        $group = $em->getRepository(ListGroup::class)->find($id);
        if (!$group) {
            return $this->json(['error' => 'Not found'], 404);
        }

        if (!$group->getUsers()->contains($user)) {
            return $this->json(['error' => 'Forbidden'], 403);
        }

        $data = json_decode($request->getContent(), true);
        $name = trim($data['name'] ?? '');

        if (!$name) {
            return $this->json(['error' => 'Name required'], 400);
        }

        $group->setName($name);
        $em->flush();

        return $this->json([
            'id' => $group->getId(),
            'name' => $group->getName(),
        ]);
    }

    #[Route('/{id}', name: 'api_list_group_delete', methods: ['DELETE'])]
    public function delete(int $id, EntityManagerInterface $em): JsonResponse
    {
        $user = $this->getUser();
        if (!$user instanceof User) {
            return $this->json(['error' => 'Unauthorized'], 401);
        }

        $group = $em->getRepository(ListGroup::class)->find($id);
        if (!$group) {
            return $this->json(['error' => 'Not found'], 404);
        }

        if (!$group->getUsers()->contains($user)) {
            return $this->json(['error' => 'Forbidden'], 403);
        }

        $em->remove($group);
        $em->flush();

        return $this->json(null, 204);
    }

    #[Route('/{id}/users', name: 'api_list_group_users', methods: ['GET'])]
    public function listUsers(int $id, EntityManagerInterface $em): JsonResponse
    {
        $user = $this->getUser();
        if (!$user instanceof User) {
            return $this->json(['error' => 'Unauthorized'], 401);
        }

        $group = $em->getRepository(ListGroup::class)->find($id);
        if (!$group) {
            return $this->json(['error' => 'Not found'], 404);
        }

        if (!$group->getUsers()->contains($user)) {
            return $this->json(['error' => 'Forbidden'], 403);
        }

        $users = [];
        foreach ($group->getUsers() as $u) {
            $users[] = [
                'id' => $u->getId(),
                'username' => $u->getUsername(),
                'email' => $u->getEmail()
            ];
        }

        return $this->json($users);
    }

    #[Route('/{id}/share', name: 'api_list_group_share', methods: ['POST'])]
    public function share(int $id, Request $request, EntityManagerInterface $em): JsonResponse
    {
        $user = $this->getUser();
        if (!$user instanceof User) {
            return $this->json(['error' => 'Unauthorized'], 401);
        }

        $group = $em->getRepository(ListGroup::class)->find($id);
        if (!$group) {
            return $this->json(['error' => 'Not found'], 404);
        }

        if (!$group->getUsers()->contains($user)) {
            return $this->json(['error' => 'Forbidden'], 403);
        }

        $data = json_decode($request->getContent(), true);
        $username = trim($data['username'] ?? '');

        if (!$username) {
            return $this->json(['error' => 'Username required'], 400);
        }

        $targetUser = $em->getRepository(User::class)->findOneBy(['username' => $username]);
        if (!$targetUser) {
            return $this->json(['error' => 'User not found'], 404);
        }

        if ($group->getUsers()->contains($targetUser)) {
            return $this->json(['error' => 'Already shared'], 400);
        }

        $group->addUser($targetUser);
        $em->flush();

        return $this->json([
            'user' => [
                'id' => $targetUser->getId(),
                'username' => $targetUser->getUsername(),
                'email' => $targetUser->getEmail()
            ]
        ], 201);
    }

    #[Route('/{id}/share/{userId}', name: 'api_list_group_unshare', methods: ['DELETE'])]
    public function unshare(int $id, int $userId, EntityManagerInterface $em): JsonResponse
    {
        $user = $this->getUser();
        if (!$user instanceof User) {
            return $this->json(['error' => 'Unauthorized'], 401);
        }

        $group = $em->getRepository(ListGroup::class)->find($id);
        if (!$group) {
            return $this->json(['error' => 'Not found'], 404);
        }

        if (!$group->getUsers()->contains($user)) {
            return $this->json(['error' => 'Forbidden'], 403);
        }

        $targetUser = $em->getRepository(User::class)->find($userId);
        if (!$targetUser) {
            return $this->json(['error' => 'User not found'], 404);
        }

        $group->removeUser($targetUser);
        $em->flush();

        return $this->json(null, 204);
    }
}
