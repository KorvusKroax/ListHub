<?php

namespace App\Repository;

use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;
use App\Entity\ListNode;
use App\Entity\User;
use App\Entity\ListShare;

class ListNodeRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, ListNode::class);
    }

    public function findAccessibleRootsForUser(User $user): array
    {
        return $this->createQueryBuilder('l')
            ->leftJoin(ListShare::class, 's', 'WITH', 's.list = l AND s.user = :user')
            ->where('l.parent IS NULL')
            ->andWhere('l.owner = :user OR s.id IS NOT NULL')
            ->setParameter('user', $user)
            ->getQuery()
            ->getResult();
    }
}
