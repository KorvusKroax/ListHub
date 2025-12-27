<?php

namespace App\Controller\Api;

use App\Entity\ListNode;
use App\Entity\ListShare;
use App\Entity\User;
use App\Repository\ListNodeRepository;
use App\Repository\UserRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;

#[Route('/api/listnodes')]
class ListNodeController extends AbstractController
{
    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly ListNodeRepository $repository,
    ) {}

    // -------------------------------
    // Permission check
    // -------------------------------
    private function checkPermission(ListNode $node, string $required = 'read'): bool
    {
        /** @var User $user */
        $user = $this->getUser();
        if (!$user) return false;

        $root = $node;
        while ($root->getParent() !== null) {
            $root = $root->getParent();
        }

        if ($root->getOwner() === $user) return true;

        foreach ($root->getShares() as $share) {
            if ($share->getUser() === $user) {
                if ($required === 'read') return true;
                if ($required === 'write' && $share->getPermission() === 'write') return true;
            }
        }

        return false;
    }

    // -------------------------------
    // Create
    // -------------------------------
    #[Route('', methods: ['POST'])]
    public function create(Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true);
        $type = $data['type'] ?? null;
        $parentId = $data['parentId'] ?? null;

        if (!in_array($type, ['item', 'sublist'], true)) {
            return $this->json(['error' => 'Invalid type'], 400);
        }

        $parent = null;
        $position = 0;
        if ($parentId !== null) {
            $parent = $this->repository->find($parentId);
            if (!$parent) return $this->json(['error' => 'Parent not found'], 404);
            if (!$this->checkPermission($parent, 'write')) {
                return $this->json(['error' => 'Forbidden'], 403);
            }
            $position = $parent->getChildren()->count();
        }

        $node = new ListNode($type);
        $node->setPosition($position);

        if ($type === 'item') {
            $node->setName($data['name'] ?? null);
            $node->setIsChecked($data['isChecked'] ?? false);
        }

        if ($parent) $parent->addChild($node);
        else $node->setOwner($this->getUser());

        $this->em->persist($node);
        $this->em->flush();

        return $this->json($node, 201, context: ['groups' => ['list']]);
    }

    // -------------------------------
    // Read root lists
    // -------------------------------
    #[Route('', methods: ['GET'])]
    public function roots(): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();

        $lists = $this->repository->createQueryBuilder('l')
            ->leftJoin('l.shares', 's', 'WITH', 's.user = :user')
            ->where('l.parent IS NULL')
            ->andWhere('(l.owner = :user OR s.id IS NOT NULL)')
            ->setParameter('user', $user)
            ->orderBy('l.id', 'ASC')
            ->distinct(true)
            ->getQuery()
            ->getResult();

        return $this->json($lists, context: ['groups' => ['list']]);
    }

    // -------------------------------
    // Read single node
    // -------------------------------
    #[Route('/{id}', methods: ['GET'])]
    public function read(int $id): JsonResponse
    {
        $node = $this->repository->find($id);
        if (!$node) return $this->json(['error' => 'Not found'], 404);
        if (!$this->checkPermission($node, 'read')) return $this->json(['error' => 'Forbidden'], 403);
        return $this->json($node, context: ['groups' => ['list']]);
    }

    // -------------------------------
    // Read children
    // -------------------------------
    #[Route('/{id}/children', methods: ['GET'])]
    public function children(int $id): JsonResponse
    {
        $node = $this->repository->find($id);
        if (!$node) return $this->json(['error' => 'Not found'], 404);
        if (!$this->checkPermission($node, 'read')) return $this->json(['error' => 'Forbidden'], 403);
        return $this->json($node->getChildren(), context: ['groups' => ['list']]);
    }

    // -------------------------------
    // Update
    // -------------------------------
    #[Route('/{id}', methods: ['PUT', 'PATCH'])]
    public function update(int $id, Request $request): JsonResponse
    {
        $node = $this->repository->find($id);
        if (!$node) return $this->json(['error' => 'Not found'], 404);
        if (!$this->checkPermission($node, 'write')) return $this->json(['error' => 'Forbidden'], 403);

        $data = json_decode($request->getContent(), true);

        if ($node->isItem()) {
            if (isset($data['name'])) $node->setName($data['name']);
            if (isset($data['isChecked'])) $node->setIsChecked((bool)$data['isChecked']);
        }

        if (isset($data['position'])) $node->setPosition((int)$data['position']);

        if (isset($data['parentId'])) {
            $newParent = $this->repository->find($data['parentId']);
            if ($newParent) {
                if (!$this->checkPermission($newParent, 'write')) return $this->json(['error' => 'Forbidden'], 403);
                if ($oldParent = $node->getParent()) $oldParent->removeChild($node);
                $newParent->addChild($node);
            }
        }

        $this->em->flush();
        return $this->json($node, context: ['groups' => ['list']]);
    }

    // -------------------------------
    // Delete
    // -------------------------------
    #[Route('/{id}', methods: ['DELETE'])]
    public function delete(int $id): JsonResponse
    {
        $node = $this->repository->find($id);
        if (!$node) return $this->json(['error' => 'Not found'], 404);
        if (!$this->checkPermission($node, 'write')) return $this->json(['error' => 'Forbidden'], 403);

        $this->em->remove($node);
        $this->em->flush();
        return $this->json(['status' => 'deleted']);
    }

    // -------------------------------
    // Share root list
    // -------------------------------
    #[Route('/{id}/share', methods: ['POST'])]
    public function share(int $id, Request $request, UserRepository $userRepo): JsonResponse
    {
        $list = $this->repository->find($id);
        if (!$list || !$list->isRoot()) return $this->json(['error' => 'List not found'], 404);
        if ($list->getOwner() !== $this->getUser()) return $this->json(['error' => 'Forbidden'], 403);

        $data = json_decode($request->getContent(), true);
        $targetUser = $userRepo->find($data['userId'] ?? 0);
        if (!$targetUser) return $this->json(['error' => 'User not found'], 404);

        $share = new ListShare($list, $targetUser, $data['permission'] ?? 'read');
        $this->em->persist($share);
        $this->em->flush();

        return $this->json(['status' => 'shared']);
    }
}
