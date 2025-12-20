<?php

namespace App\Controller;

use App\Entity\Item;
use App\Entity\ListEntity;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;

class ListController extends AbstractController
{
    #[Route('/lists', name: 'app_lists')]
    public function index(EntityManagerInterface $em): Response
    {
        $user = $this->getUser();
        if (!$user) {
            return $this->redirectToRoute('app_login');
        }

        // Azok a listák, amikhez a user hozzá van rendelve
        $lists = $em->getRepository(ListEntity::class)
            ->createQueryBuilder('l')
            ->join('l.users', 'u')
            ->andWhere('u = :user')
            ->setParameter('user', $user)
            ->getQuery()
            ->getResult();

        return $this->render('list/index.html.twig', [
            'lists' => $lists,
        ]);
    }

    #[Route('/lists/{id}', name: 'app_list_show', requirements: ['id' => '\d+'], methods: ['GET', 'POST'])]
    public function show(
        int $id,
        Request $request,
        EntityManagerInterface $em
    ): Response {
        $user = $this->getUser();
        if (!$user) {
            return $this->redirectToRoute('app_login');
        }

        $list = $em->getRepository(ListEntity::class)->find($id);
        if (!$list) {
            throw $this->createNotFoundException('Lista nem található.');
        }

        // egyszerű jogosultság: a usernek a list users kapcsolatban kell lennie
        if (!$list->getUsers()->contains($user)) {
            throw $this->createAccessDeniedException('Nincs jogosultságod ehhez a listához.');
        }

        // Új item hozzáadása (egyszerű POST form, csak name mezővel)
        if ($request->isMethod('POST')) {
            $name = trim((string) $request->request->get('name', ''));
            if ($name !== '') {
                $item = new Item();
                $item->setName($name);
                $item->setIsChecked(false);
                $item->setList($list);

                $em->persist($item);
                $em->flush();

                return $this->redirectToRoute('app_list_show', ['id' => $list->getId()]);
            }
        }

        return $this->render('list/show.html.twig', [
            'list' => $list,
        ]);
    }

    #[Route('/lists/{listId}/item/{itemId}/delete', name: 'app_item_delete', requirements: ['listId' => '\d+', 'itemId' => '\d+'], methods: ['POST'])]
    public function deleteItem(
        int $listId,
        int $itemId,
        Request $request,
        EntityManagerInterface $em
    ): Response {
        $user = $this->getUser();
        if (!$user) {
            return $this->redirectToRoute('app_login');
        }

        $list = $em->getRepository(ListEntity::class)->find($listId);
        if (!$list) {
            throw $this->createNotFoundException('Lista nem található.');
        }

        if (!$list->getUsers()->contains($user)) {
            throw $this->createAccessDeniedException('Nincs jogosultságod ehhez a listához.');
        }

        $item = $em->getRepository(Item::class)->find($itemId);
        if ($item && $item->getList() === $list) {
            $em->remove($item);
            $em->flush();
        }

        return $this->redirectToRoute('app_list_show', ['id' => $list->getId()]);
    }
}
